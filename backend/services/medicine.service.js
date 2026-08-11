import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import * as medicineRepository from '../repositories/medicine.repository.js';
import * as medicineBatchRepository from '../repositories/medicineBatch.repository.js';
import * as pharmacyStockMovementRepository from '../repositories/pharmacyStockMovement.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listMedicines(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await medicineRepository.findAll({
    tenantId, page, limit, search: query.search,
    categoryId: query.categoryId ? Number(query.categoryId) : undefined, status: query.status,
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

export async function createMedicine(data, userId, tenantId) {
  if (Number(data.sellingPrice) <= 0) throw new ApiError(400, 'Selling price must be greater than zero');
  const medicine = await medicineRepository.create({ ...data, tenantId, userId });
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Medicine "${medicine.name}" created`,
    referenceType: 'medicine', referenceId: medicine.id,
  });
  return medicine;
}

export async function updateMedicine(id, data, userId, tenantId) {
  await getMedicine(id, tenantId);
  if (Number(data.sellingPrice) <= 0) throw new ApiError(400, 'Selling price must be greater than zero');
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
