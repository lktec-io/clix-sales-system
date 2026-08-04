import { ApiError } from '../utils/apiError.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listBranches(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await branchRepository.findAll({
    tenantId,
    page,
    limit,
    search: query.search,
    status: query.status,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getBranch(id, tenantId) {
  const branch = await branchRepository.findById(id, tenantId);
  if (!branch) throw new ApiError(404, 'Branch not found');
  return branch;
}

async function assertUniqueCode(code, tenantId, excludeId = null) {
  const existing = await branchRepository.findByCode(code, tenantId);
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, 'A branch with this code already exists');
  }
}

export async function createBranch(data, actorId, tenantId) {
  await assertUniqueCode(data.code, tenantId);

  const branch = await branchRepository.create({ ...data, userId: actorId, tenantId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: branch.id,
    description: `Branch "${branch.name}" created`,
    referenceType: 'branch',
    referenceId: branch.id,
  });
  return branch;
}

export async function updateBranch(id, data, actorId, tenantId) {
  const existing = await branchRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Branch not found');

  await assertUniqueCode(data.code, tenantId, id);

  const branch = await branchRepository.update(id, tenantId, { ...data, userId: actorId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: id,
    description: `Branch "${branch.name}" updated`,
    referenceType: 'branch',
    referenceId: id,
  });
  return branch;
}

export async function changeStatus(id, status, actorId, tenantId) {
  const existing = await branchRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Branch not found');

  if (status === 'inactive') {
    const usersAssigned = await branchRepository.countUsersAssigned(id, tenantId);
    if (usersAssigned > 0) {
      throw new ApiError(409, `Cannot deactivate this branch — ${usersAssigned} user(s) are still assigned to it`);
    }
  }

  const branch = await branchRepository.updateStatus(id, tenantId, status, actorId);
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: id,
    description: `Branch "${existing.name}" status changed to ${status}`,
    referenceType: 'branch',
    referenceId: id,
  });
  return branch;
}
