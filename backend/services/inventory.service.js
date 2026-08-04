import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import * as inventoryRepository from '../repositories/inventory.repository.js';
import * as productRepository from '../repositories/product.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listInventory(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);

  const { rows, total } = await inventoryRepository.findAll({
    tenantId: user.tenantId,
    page,
    limit,
    search: query.search,
    branchId: query.branchId ? Number(query.branchId) : undefined,
    lowStock: query.lowStock === 'true',
    outOfStock: query.outOfStock === 'true',
    branchIds,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getSummary(user) {
  const branchIds = await getAccessibleBranchIds(user);
  return inventoryRepository.getSummary(user.tenantId, branchIds);
}

export async function listMovements(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);

  const { rows, total } = await inventoryRepository.findMovements({
    tenantId: user.tenantId,
    page,
    limit,
    productId: query.productId ? Number(query.productId) : undefined,
    branchId: query.branchId ? Number(query.branchId) : undefined,
    movementType: query.movementType,
    branchIds,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

export async function createAdjustment(data, user) {
  const product = await productRepository.findById(data.productId, user.tenantId);
  if (!product) throw new ApiError(404, 'Product not found');

  const branch = await branchRepository.findById(data.branchId, user.tenantId);
  if (!branch) throw new ApiError(404, 'Branch not found');

  await assertBranchAccess(user, data.branchId);

  const { movementId, previousStock, newStock } = await inventoryRepository.recordMovement({
    tenantId: user.tenantId,
    productId: data.productId,
    branchId: data.branchId,
    movementType: 'adjustment',
    quantityChange: data.quantityChange,
    referenceType: 'inventory_adjustment',
    referenceId: null,
    userId: user.id,
  });

  await inventoryRepository.createAdjustmentRecord({
    tenantId: user.tenantId,
    productId: data.productId,
    branchId: data.branchId,
    movementId,
    reason: data.reason,
    description: data.description,
    userId: user.id,
  });

  await activityLogRepository.create({
    userId: user.id,
    branchId: data.branchId,
    description: `Stock adjustment for "${product.name}": ${previousStock} → ${newStock} (${data.reason})`,
    referenceType: 'inventory_adjustment',
    referenceId: movementId,
  });

  return { previousStock, newStock };
}
