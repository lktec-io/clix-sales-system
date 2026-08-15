import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as pharmacySaleRepository from '../repositories/pharmacySale.repository.js';
import * as medicineRepository from '../repositories/medicine.repository.js';
import * as medicineBatchRepository from '../repositories/medicineBatch.repository.js';
import * as pharmacyStockMovementRepository from '../repositories/pharmacyStockMovement.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Mirrors the identical private helper in sale.service.js/purchase.service.js
// and siblings — without it, a Cashier/attendant restricted to one branch
// could submit any branchId in their own tenant and have stock dispensed
// from a branch they have no assignment to.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

export async function listSales(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);
  const { rows, total } = await pharmacySaleRepository.findAll({
    tenantId: user.tenantId, page, limit, search: query.search,
    branchId: query.branchId ? Number(query.branchId) : undefined, branchIds,
    dateFrom: query.dateFrom, dateTo: query.dateTo,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getSale(id, tenantId) {
  const sale = await pharmacySaleRepository.findById(id, tenantId);
  if (!sale) throw new ApiError(404, 'Sale not found');
  return sale;
}

// Reshapes a pharmacy sale into the exact field names
// receiptService.js#buildReceiptPdf already expects (built for `sales`/
// `sale_items`) — reused as-is rather than building a second PDF engine.
// Pharmacy sales have no discount/tax concept and a single payment method
// per sale (not an array of partial payments like retail), so those map to
// the simplest valid shape: zero discount/tax, one payment covering the
// full total.
export async function getSaleForReceipt(id, tenantId) {
  const sale = await getSale(id, tenantId);
  return {
    ...sale,
    cashier_first_name: sale.sold_by_first_name,
    cashier_last_name: sale.sold_by_last_name,
    subtotal: sale.total_amount,
    discount_amount: 0,
    tax_amount: 0,
    items: sale.items.map((item) => ({
      product_name: item.medicine_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: 0,
      line_total: item.line_total,
    })),
    payments: [{ payment_method: sale.payment_method, amount: sale.total_amount }],
  };
}

// The core FEFO dispensing transaction: for each requested medicine, walk
// its non-expired batches oldest-expiry-first, allocating quantity across
// as many as needed. Locks every batch it reads (FOR UPDATE) so two
// concurrent sales can never both allocate from the same remaining units —
// the second sale's read blocks until the first's transaction commits or
// rolls back, then sees the already-decremented quantity. An expired batch
// is never even a candidate (findSellableBatchesForUpdate excludes it at
// the SQL level) — there is no code path that can dispense one.
export async function sellMedicines(data, actorId, tenantId, user) {
  if (!data.items?.length) throw new ApiError(400, 'Add at least one medicine to the sale');

  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, data.branchId);

  if (data.customerId) {
    const customer = await customerRepository.findById(data.customerId, tenantId);
    if (!customer) throw new ApiError(400, 'Selected customer does not exist');
  }

  // Keyed by medicineId so the allocation loop below can price each batch
  // off the medicine's own (server-side, NOT NULL) selling_price without a
  // second fetch — see the unitPrice comment there for why this matters.
  const medicineById = new Map();
  for (const item of data.items) {
    if (!(Number(item.quantity) > 0)) throw new ApiError(400, 'Quantity must be greater than zero for every item');
    const medicine = await medicineRepository.findById(item.medicineId, tenantId);
    if (!medicine || medicine.status !== 'active') throw new ApiError(400, `Medicine ${item.medicineId} is not available`);
    medicineById.set(item.medicineId, medicine);
  }

  const saleNumber = await generateCode('PHARMACY_SALE', 'PSL', { tenantId, padLength: 6 });

  const connection = await pool.getConnection();
  let saleId;
  let totalAmount = 0;
  try {
    await connection.beginTransaction();

    saleId = await pharmacySaleRepository.create({
      tenantId, branchId: data.branchId, customerId: data.customerId, saleNumber,
      paymentMethod: data.paymentMethod, totalAmount: 0, soldBy: actorId,
    }, connection);

    for (const item of data.items) {
      const requestedQty = Number(item.quantity);
      const batches = await medicineBatchRepository.findSellableBatchesForUpdate(item.medicineId, data.branchId, tenantId, connection);
      const availableQty = batches.reduce((sum, b) => sum + b.quantity, 0);
      if (availableQty < requestedQty) {
        const medicine = await medicineRepository.findById(item.medicineId, tenantId);
        throw new ApiError(400, `Insufficient stock for "${medicine?.name || item.medicineId}" — only ${availableQty} available (non-expired)`);
      }

      let remaining = requestedQty;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const takeFromBatch = Math.min(batch.quantity, remaining);
        if (takeFromBatch <= 0) continue;

        // Price is always server-derived: the batch's own override if set,
        // else the medicine's own selling_price — never the client-supplied
        // item.unitPrice, which a request could set to anything.
        const unitPrice = Number(batch.selling_price ?? medicineById.get(item.medicineId).selling_price) || 0;
        const lineTotal = round2(takeFromBatch * unitPrice);
        totalAmount = round2(totalAmount + lineTotal);
        remaining -= takeFromBatch;

        await medicineBatchRepository.decrementQuantity(batch.id, takeFromBatch, connection);
        await pharmacySaleRepository.createItem({
          saleId, medicineId: item.medicineId, batchId: batch.id, quantity: takeFromBatch, unitPrice, lineTotal,
        }, connection);
        await pharmacyStockMovementRepository.record({
          tenantId, medicineId: item.medicineId, batchId: batch.id, branchId: data.branchId,
          movementType: 'sale', quantityChange: -takeFromBatch,
          referenceType: 'pharmacy_sale', referenceId: saleId, userId: actorId,
        }, connection);
      }
    }

    await connection.query('UPDATE pharmacy_sales SET total_amount = ? WHERE id = ?', [totalAmount, saleId]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: data.branchId,
    description: `Pharmacy sale "${saleNumber}" completed (${formatCurrency(totalAmount)})`,
    referenceType: 'pharmacy_sale', referenceId: saleId,
  });

  return pharmacySaleRepository.findById(saleId, tenantId);
}

export async function getSalesSummary(user) {
  const branchIds = await getAccessibleBranchIds(user);
  return pharmacySaleRepository.getSalesSummary(user.tenantId, branchIds);
}

export async function getRecentSales(user, limit = 5) {
  const branchIds = await getAccessibleBranchIds(user);
  return pharmacySaleRepository.findRecent(user.tenantId, branchIds, limit);
}
