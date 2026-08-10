import { ApiError } from '../utils/apiError.js';
import * as loanGroupRepository from '../repositories/loanGroup.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listGroups(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await loanGroupRepository.findAll({
    tenantId, page, limit, search: query.search, status: query.status,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getGroup(id, tenantId) {
  const group = await loanGroupRepository.findById(id, tenantId);
  if (!group) throw new ApiError(404, 'Group not found');
  const members = await loanGroupRepository.findMembers(id);
  return { ...group, members };
}

export async function createGroup(data, userId, tenantId) {
  if (data.leaderCustomerId) {
    const leader = await customerRepository.findById(data.leaderCustomerId, tenantId);
    if (!leader) throw new ApiError(400, 'Selected group leader does not exist');
  }
  const group = await loanGroupRepository.create({ tenantId, name: data.name, leaderCustomerId: data.leaderCustomerId, userId });
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Borrower group "${group.name}" created`,
    referenceType: 'loan_group', referenceId: group.id,
  });
  return group;
}

export async function updateGroup(id, data, tenantId) {
  await getGroup(id, tenantId);
  return loanGroupRepository.update(id, tenantId, { name: data.name, leaderCustomerId: data.leaderCustomerId, status: data.status });
}

export async function addMember(groupId, customerId, tenantId) {
  await getGroup(groupId, tenantId);
  const customer = await customerRepository.findById(customerId, tenantId);
  if (!customer) throw new ApiError(400, 'Selected customer does not exist');
  await loanGroupRepository.addMember(groupId, customerId);
  return loanGroupRepository.findMembers(groupId);
}

export async function removeMember(groupId, customerId, tenantId) {
  await getGroup(groupId, tenantId);
  await loanGroupRepository.removeMember(groupId, customerId);
  return loanGroupRepository.findMembers(groupId);
}
