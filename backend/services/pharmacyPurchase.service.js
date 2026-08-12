import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as pharmacyPurchaseRepository from '../repositories/pharmacyPurchase.repository.js';
import * as medicineRepository from '../repositories/medicine.repository.js';
import * as medicineBatchRepository from '../repositories/medicineBatch.repository.js';
import * as pharmacyStockMovementRepository from '../repositories/pharmacyStockMovement.repository.js';
import * as supplierRepository from '../repositories/supplier.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Mirrors sale.service.js/purchase.service.js's identical helper.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

export async function listPurchases(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);
  const { rows, total } = await pharmacyPurchaseRepository.findAll({
    tenantId: user.tenantId, page, limit, search: query.search, branchIds,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getPurchase(id, tenantId) {
  const purchase = await pharmacyPurchaseRepository.findById(id, tenantId);
  if (!purchase) throw new ApiError(404, 'Purchase not found');
  return purchase;
}

// Receives stock into batches — one purchase, every line item, and every
// batch it creates/updates, all one transaction (mirrors purchase.service
// .js#createPurchase()'s existing "all-or-nothing" guarantee for the
// retail Purchases module). A batch_number that already exists for this
// exact (medicine, branch) is topped up rather than duplicated, so
// receiving the same batch twice (e.g. a split delivery) accumulates
// quantity onto one row instead of fragmenting FEFO ordering across two.
export async function receiveStock(data, actorId, tenantId, user) {
  if (!data.items?.length) throw new ApiError(400, 'Add at least one medicine to the purchase');

  const supplier = await supplierRepository.findById(data.supplierId, tenantId);
  if (!supplier) throw new ApiError(400, 'Selected supplier does not exist');

  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, data.branchId);

  for (const item of data.items) {
    if (!(Number(item.quantity) > 0)) throw new ApiError(400, 'Quantity must be greater than zero for every item');
    if (!(Number(item.buyingPrice) >= 0)) throw new ApiError(400, 'Buying price cannot be negative');
    if (!item.expiryDate) throw new ApiError(400, 'Expiry date is required for every item');
    if (new Date(item.expiryDate) <= new Date()) throw new ApiError(400, 'Expiry date must be in the future');
    if (!item.batchNumber) throw new ApiError(400, 'Batch number is required for every item');
    const medicine = await medicineRepository.findById(item.medicineId, tenantId);
    if (!medicine || medicine.status !== 'active') throw new ApiError(400, `Medicine ${item.medicineId} is not available`);
  }

  const purchaseNumber = await generateCode('PHARMACY_PURCHASE', 'PPO', { tenantId, padLength: 6 });
  const totalAmount = round2(data.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.buyingPrice), 0));

  const connection = await pool.getConnection();
  let purchaseId;
  try {
    await connection.beginTransaction();

    purchaseId = await pharmacyPurchaseRepository.create({
      tenantId, branchId: data.branchId, supplierId: data.supplierId, purchaseNumber,
      reference: data.reference, purchaseDate: data.purchaseDate || new Date(), totalAmount, createdBy: actorId,
    }, connection);

    for (const item of data.items) {
      const lineTotal = round2(Number(item.quantity) * Number(item.buyingPrice));

      const [existing] = await connection.query(
        'SELECT id, quantity FROM medicine_batches WHERE medicine_id = ? AND branch_id = ? AND batch_number = ? AND tenant_id = ? LIMIT 1 FOR UPDATE',
        [item.medicineId, data.branchId, item.batchNumber, tenantId],
      );

      let batchId;
      if (existing[0]) {
        batchId = existing[0].id;
        await medicineBatchRepository.incrementQuantity(batchId, Number(item.quantity), connection);
      } else {
        batchId = await medicineBatchRepository.create({
          tenantId, medicineId: item.medicineId, branchId: data.branchId, supplierId: data.supplierId,
          batchNumber: item.batchNumber, buyingPrice: item.buyingPrice, sellingPrice: item.sellingPrice,
          quantity: Number(item.quantity), expiryDate: item.expiryDate, receivedDate: data.purchaseDate || new Date(),
        }, connection);
      }

      await pharmacyPurchaseRepository.createItem({
        purchaseId, medicineId: item.medicineId, batchId, quantity: Number(item.quantity), buyingPrice: item.buyingPrice, lineTotal,
      }, connection);
      await pharmacyStockMovementRepository.record({
        tenantId, medicineId: item.medicineId, batchId, branchId: data.branchId,
        movementType: 'purchase', quantityChange: Number(item.quantity),
        referenceType: 'pharmacy_purchase', referenceId: purchaseId, userId: actorId,
      }, connection);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: data.branchId,
    description: `Pharmacy purchase "${purchaseNumber}" received from "${supplier.name}" (${formatCurrency(totalAmount)})`,
    referenceType: 'pharmacy_purchase', referenceId: purchaseId,
  });

  return pharmacyPurchaseRepository.findById(purchaseId, tenantId);
}
