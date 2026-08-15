import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import * as medicineRepository from '../repositories/medicine.repository.js';
import * as medicineBatchRepository from '../repositories/medicineBatch.repository.js';
import * as pharmacyStockMovementRepository from '../repositories/pharmacyStockMovement.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

// Mirrors the identical private helper in pharmacySale.service.js and every
// other branch-scoped service — without it, a Cashier/attendant restricted
// to one branch could record opening stock against a branch they have no
// assignment to.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

// Powers the Pharmacy POS's product grid — mirrors
// product.service.js#getSellableProducts exactly.
export async function getSellableMedicines(query, user) {
  if (!query.branchId) throw new ApiError(400, 'Branch is required');
  const branchId = Number(query.branchId);
  await assertBranchAccess(user, branchId);

  return medicineRepository.findSellable({
    tenantId: user.tenantId,
    branchId,
    search: query.search,
    categoryId: query.categoryId ? Number(query.categoryId) : undefined,
  });
}

export async function getSellableMedicineByBarcode(query, user) {
  if (!query.branchId) throw new ApiError(400, 'Branch is required');
  if (!query.barcode) throw new ApiError(400, 'Barcode is required');
  const branchId = Number(query.branchId);
  await assertBranchAccess(user, branchId);

  return medicineRepository.findSellableByBarcode({ tenantId: user.tenantId, barcode: query.barcode.trim(), branchId });
}

export async function listMedicines(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await medicineRepository.findAll({
    tenantId, page, limit, search: query.search,
    categoryId: query.categoryId ? Number(query.categoryId) : undefined, status: query.status,
    stockStatus: query.stockStatus,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getMedicine(id, tenantId) {
  const medicine = await medicineRepository.findById(id, tenantId);
  if (!medicine) throw new ApiError(404, 'Medicine not found');
  const [batches, movements] = await Promise.all([
    medicineBatchRepository.findByMedicine(id, tenantId),
    pharmacyStockMovementRepository.findByMedicine(id, tenantId, { limit: 10 }),
  ]);
  return { ...medicine, batches, recentMovements: movements.rows };
}

async function assertBarcodeAvailable(barcode, tenantId, excludeId = null) {
  if (!barcode) return;
  const existing = await medicineRepository.findByBarcode(barcode, tenantId);
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, 'A medicine with this barcode already exists');
  }
}

// The simplified Medicine creation form (Pharmacy Simplification phase)
// lets the owner optionally record opening stock in the same step instead
// of a separate "Receive Stock" trip — data.initialStock is only present
// when the user actually filled in a quantity. Reuses the exact same
// batch + stock-movement writes medicineImport.service.js#importRow uses
// for "new medicine with opening stock", so there is only one place in the
// codebase that knows how to create a medicine's first batch.
export async function createMedicine(data, userId, tenantId, user) {
  if (Number(data.sellingPrice) <= 0) throw new ApiError(400, 'Selling price must be greater than zero');
  await assertBarcodeAvailable(data.barcode, tenantId);

  const hasInitialStock = data.initialStock && Number(data.initialStock.quantity) > 0;
  if (!hasInitialStock) {
    const medicine = await medicineRepository.create({ ...data, tenantId, userId });
    await activityLogRepository.create({
      tenantId, userId, branchId: null,
      description: `Medicine "${medicine.name}" created`,
      referenceType: 'medicine', referenceId: medicine.id,
    });
    return medicine;
  }

  const { quantity, buyingPrice, batchNumber, expiryDate, branchId } = data.initialStock;
  if (!branchId) throw new ApiError(400, 'Branch is required to record opening stock');
  if (!batchNumber) throw new ApiError(400, 'Batch number is required when adding opening stock');
  if (!expiryDate) throw new ApiError(400, 'Expiry date is required when adding opening stock');
  await assertBranchAccess(user, Number(branchId));

  const connection = await pool.getConnection();
  let medicineId;
  try {
    await connection.beginTransaction();
    const created = await medicineRepository.create({ ...data, tenantId, userId }, connection);
    medicineId = created.id;

    const batchId = await medicineBatchRepository.create({
      tenantId, medicineId, branchId: Number(branchId), supplierId: null,
      batchNumber, buyingPrice: Number(buyingPrice) || 0, sellingPrice: null,
      quantity: Number(quantity), expiryDate, receivedDate: new Date(),
    }, connection);
    await pharmacyStockMovementRepository.record({
      tenantId, medicineId, batchId, branchId: Number(branchId),
      movementType: 'purchase', quantityChange: Number(quantity),
      referenceType: 'medicine_create', referenceId: medicineId, userId,
    }, connection);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const medicine = await medicineRepository.findById(medicineId, tenantId);
  await activityLogRepository.create({
    tenantId, userId, branchId: Number(branchId),
    description: `Medicine "${medicine.name}" created with opening stock (${quantity} ${medicine.unit})`,
    referenceType: 'medicine', referenceId: medicineId,
  });
  return medicine;
}

export async function updateMedicine(id, data, userId, tenantId) {
  await getMedicine(id, tenantId);
  if (Number(data.sellingPrice) <= 0) throw new ApiError(400, 'Selling price must be greater than zero');
  await assertBarcodeAvailable(data.barcode, tenantId, id);
  const medicine = await medicineRepository.update(id, tenantId, { ...data, userId });
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Medicine "${medicine.name}" updated`,
    referenceType: 'medicine', referenceId: id,
  });
  return medicine;
}

export async function deleteMedicine(id, userId, tenantId) {
  const existing = await medicineRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Medicine not found');
  if (Number(existing.current_stock) > 0) {
    throw new ApiError(400, 'Cannot delete a medicine that still has stock — adjust or dispense the remaining batches first');
  }
  await medicineRepository.softDelete(id, tenantId);
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Medicine "${existing.name}" deleted`,
    referenceType: 'medicine', referenceId: id,
  });
}

export async function listExpiring(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);
  const { rows, total } = await medicineBatchRepository.findExpiring({
    tenantId: user.tenantId, branchIds, status: query.status, page, limit,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getDashboardSummary(user) {
  const branchIds = await getAccessibleBranchIds(user);
  const [stock, expiry] = await Promise.all([
    medicineRepository.getStockSummary(user.tenantId, branchIds),
    medicineBatchRepository.getExpirySummary(user.tenantId, branchIds),
  ]);
  return { ...stock, ...expiry };
}
