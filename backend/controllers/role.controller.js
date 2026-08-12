import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as roleRepository from '../repositories/role.repository.js';
import * as roleService from '../services/role.service.js';

// GET / stays a minimal read-only lookup (used by dropdowns outside this
// module too); everything else is the full Phase 4 management surface.
export const list = asyncHandler(async (req, res) => {
  const roles = await roleRepository.findAll(req.user.tenantId);
  return success(res, { data: roles });
});

export const listAllPermissions = asyncHandler(async (req, res) => {
  const grouped = await roleService.listPermissions();
  return success(res, { data: grouped });
});

export const create = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Role created', data: role, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const role = await roleService.updateRole(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Role updated', data: role });
});

export const remove = asyncHandler(async (req, res) => {
  await roleService.deleteRole(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Role deleted' });
});

export const getPermissions = asyncHandler(async (req, res) => {
  const permissionIds = await roleService.getRolePermissionIds(Number(req.params.id), req.user.tenantId);
  return success(res, { data: permissionIds });
});

export const setPermissions = asyncHandler(async (req, res) => {
  await roleService.setRolePermissions(Number(req.params.id), req.body.permissionIds, req.user.id, req.user.tenantId);
  return success(res, { message: 'Role permissions updated' });
});
