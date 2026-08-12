import { ApiError } from '../utils/apiError.js';
import * as roleRepository from '../repositories/role.repository.js';
import * as permissionRepository from '../repositories/permission.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { invalidatePermissionCache } from '../middlewares/authorize.js';

export async function listRoles(tenantId) {
  return roleRepository.findAll(tenantId);
}

export async function listPermissions() {
  const permissions = await permissionRepository.findAll();
  const grouped = {};
  for (const permission of permissions) {
    if (!grouped[permission.module]) grouped[permission.module] = [];
    grouped[permission.module].push(permission);
  }
  return grouped;
}

export async function getRolePermissionIds(roleId, tenantId) {
  const role = await roleRepository.findById(roleId, tenantId);
  if (!role) throw new ApiError(404, 'Role not found');
  return permissionRepository.getIdsForRole(roleId);
}

export async function createRole(data, actorId, tenantId) {
  const existing = await roleRepository.findByName(data.name, tenantId);
  if (existing) throw new ApiError(409, 'A role with this name already exists');

  const role = await roleRepository.create({ name: data.name, description: data.description, userId: actorId, tenantId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Role "${role.name}" created`,
    referenceType: 'role',
    referenceId: role.id,
  });
  return role;
}

export async function updateRole(id, data, actorId, tenantId) {
  const existing = await roleRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Role not found');

  if (existing.is_system && data.name !== existing.name) {
    throw new ApiError(400, 'System roles cannot be renamed');
  }
  if (existing.is_system) {
    throw new ApiError(400, 'System roles cannot be edited');
  }

  const conflict = await roleRepository.findByName(data.name, tenantId);
  if (conflict && conflict.id !== id) {
    throw new ApiError(409, 'A role with this name already exists');
  }

  const role = await roleRepository.update(id, tenantId, { name: data.name, description: data.description, userId: actorId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Role "${role.name}" updated`,
    referenceType: 'role',
    referenceId: id,
  });
  return role;
}

export async function deleteRole(id, actorId, tenantId) {
  const existing = await roleRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Role not found');
  if (existing.is_system) throw new ApiError(400, 'System roles cannot be deleted');

  const userCount = await roleRepository.countUsersWithRole(id);
  if (userCount > 0) {
    throw new ApiError(409, `Cannot delete this role — ${userCount} user(s) are still assigned to it`);
  }

  await roleRepository.softDelete(id, tenantId, actorId);
  invalidatePermissionCache(id);
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Role "${existing.name}" deleted`,
    referenceType: 'role',
    referenceId: id,
  });
}

export async function setRolePermissions(id, permissionIds, actorId, tenantId) {
  const role = await roleRepository.findById(id, tenantId);
  if (!role) throw new ApiError(404, 'Role not found');
  if (role.is_system) throw new ApiError(400, 'System role permissions cannot be edited here');

  await permissionRepository.replaceForRole(id, permissionIds);
  invalidatePermissionCache(id);

  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Permissions updated for role "${role.name}"`,
    referenceType: 'role',
    referenceId: id,
  });
}
