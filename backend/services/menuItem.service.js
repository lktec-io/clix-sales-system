import { ApiError } from '../utils/apiError.js';
import * as menuItemRepository from '../repositories/menuItem.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listMenuItems(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const isAvailable = query.isAvailable === undefined ? undefined : query.isAvailable === 'true';
  const { rows, total } = await menuItemRepository.findAll({
    tenantId, page, limit, search: query.search,
    categoryId: query.categoryId ? Number(query.categoryId) : undefined, isAvailable,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getMenuItem(id, tenantId) {
  const item = await menuItemRepository.findById(id, tenantId);
  if (!item) throw new ApiError(404, 'Menu item not found');
  return item;
}

export async function createMenuItem(data, userId, tenantId) {
  if (Number(data.sellingPrice) <= 0) throw new ApiError(400, 'Selling price must be greater than zero');
  const item = await menuItemRepository.create({ ...data, tenantId, userId });
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Menu item "${item.name}" created`,
    referenceType: 'menu_item', referenceId: item.id,
  });
  return item;
}

export async function updateMenuItem(id, data, userId, tenantId) {
  await getMenuItem(id, tenantId);
  if (Number(data.sellingPrice) <= 0) throw new ApiError(400, 'Selling price must be greater than zero');
  const item = await menuItemRepository.update(id, tenantId, { ...data, userId });
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Menu item "${item.name}" updated`,
    referenceType: 'menu_item', referenceId: id,
  });
  return item;
}

export async function deleteMenuItem(id, userId, tenantId) {
  const existing = await getMenuItem(id, tenantId);
  await menuItemRepository.softDelete(id, tenantId);
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Menu item "${existing.name}" deleted`,
    referenceType: 'menu_item', referenceId: id,
  });
}
