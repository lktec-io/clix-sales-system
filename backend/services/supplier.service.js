import { ApiError } from '../utils/apiError.js';
import * as supplierRepository from '../repositories/supplier.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listSuppliers(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await supplierRepository.findAll({
    tenantId, page, limit, search: query.search, status: query.status,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getSupplier(id, tenantId) {
  const supplier = await supplierRepository.findById(id, tenantId);
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  const balance = await supplierRepository.getBalance(id, tenantId);
  return { ...supplier, ...balance };
}

export async function getPurchaseHistory(id, query, tenantId) {
  const supplier = await supplierRepository.findById(id, tenantId);
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await supplierRepository.findPurchaseHistory(id, tenantId, { page, limit });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function createSupplier(data, actorId, tenantId) {
  const supplier = await supplierRepository.create({ ...data, tenantId, userId: actorId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Supplier "${supplier.name}" created`,
    referenceType: 'supplier',
    referenceId: supplier.id,
  });
  return supplier;
}

export async function updateSupplier(id, data, actorId, tenantId) {
  const existing = await supplierRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Supplier not found');

  const supplier = await supplierRepository.update(id, tenantId, { ...data, userId: actorId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Supplier "${supplier.name}" updated`,
    referenceType: 'supplier',
    referenceId: id,
  });
  return supplier;
}

export async function changeStatus(id, status, actorId, tenantId) {
  const existing = await supplierRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Supplier not found');

  const supplier = await supplierRepository.updateStatus(id, tenantId, status, actorId);
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Supplier "${existing.name}" status changed to ${status}`,
    referenceType: 'supplier',
    referenceId: id,
  });
  return supplier;
}

export async function deleteSupplier(id, actorId, tenantId) {
  const existing = await supplierRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Supplier not found');

  try {
    await supplierRepository.hardDelete(id, tenantId);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      throw new ApiError(409, 'Cannot delete this supplier — they have existing purchase orders or payments on record.');
    }
    throw err;
  }

  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Supplier "${existing.name}" permanently deleted`,
    referenceType: 'supplier',
    referenceId: id,
  });
}
