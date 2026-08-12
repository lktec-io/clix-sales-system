import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import * as restaurantTableRepository from '../repositories/restaurantTable.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

// Mirrors sale.service.js/purchase.service.js's identical helper.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

export async function listTables(query, user) {
  const branchIds = await getAccessibleBranchIds(user);
  return restaurantTableRepository.findAll({
    tenantId: user.tenantId, branchIds,
    branchId: query.branchId ? Number(query.branchId) : undefined, status: query.status,
  });
}

export async function listAvailableTables(user) {
  const branchIds = await getAccessibleBranchIds(user);
  return restaurantTableRepository.findAvailable(user.tenantId, branchIds);
}

export async function getTable(id, tenantId) {
  const table = await restaurantTableRepository.findById(id, tenantId);
  if (!table) throw new ApiError(404, 'Table not found');
  return table;
}

export async function createTable(data, userId, tenantId, user) {
  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, data.branchId);
  const table = await restaurantTableRepository.create({ ...data, tenantId });
  await activityLogRepository.create({
    tenantId, userId, branchId: data.branchId,
    description: `Table "${table.table_number}" created`,
    referenceType: 'restaurant_table', referenceId: table.id,
  });
  return table;
}

export async function updateTable(id, data, userId, tenantId) {
  const existing = await getTable(id, tenantId);
  const table = await restaurantTableRepository.update(id, tenantId, data);
  await activityLogRepository.create({
    tenantId, userId, branchId: existing.branch_id,
    description: `Table "${table.table_number}" updated`,
    referenceType: 'restaurant_table', referenceId: id,
  });
  return table;
}

export async function setTableActive(id, isActive, userId, tenantId) {
  const table = await getTable(id, tenantId);
  await restaurantTableRepository.setActive(id, tenantId, isActive);
  await activityLogRepository.create({
    tenantId, userId, branchId: table.branch_id,
    description: `Table "${table.table_number}" ${isActive ? 'activated' : 'deactivated'}`,
    referenceType: 'restaurant_table', referenceId: id,
  });
}

// A table's 'occupied' status is exclusively system-driven by an actual
// open order (restaurantOrder.service.js sets it on order creation and
// clears it on completion/cancellation) — never manually settable here, so
// the floor plan can never show "occupied" with no real order behind it.
// Staff can only toggle between the two states they legitimately control.
export async function setTableStatus(id, status, tenantId) {
  const table = await getTable(id, tenantId);
  if (!['available', 'reserved'].includes(status)) {
    throw new ApiError(400, 'Table status can only be manually set to available or reserved');
  }
  if (table.status === 'occupied') {
    throw new ApiError(400, 'Cannot change the status of a table with an active order');
  }
  await restaurantTableRepository.setStatus(id, tenantId, status);
  return getTable(id, tenantId);
}

export async function getOccupancySummary(user) {
  const branchIds = await getAccessibleBranchIds(user);
  return restaurantTableRepository.getOccupancySummary(user.tenantId, branchIds);
}
