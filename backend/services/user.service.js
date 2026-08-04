import { ApiError } from '../utils/apiError.js';
import * as userRepository from '../repositories/user.repository.js';
import * as roleRepository from '../repositories/role.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { hashPassword } from './auth.service.js';
import { resolveUploadedFileUrl } from '../middlewares/upload.js';

function sanitize(user) {
  if (!user) return user;
  const { password_hash: _passwordHash, ...safe } = user;
  return safe;
}

// findById() is intentionally NOT tenant-scoped at the repository level (it
// also serves the login/token-refresh path, where the tenant is derived
// FROM this lookup, not known ahead of it). Every admin-facing entry point
// below resolves the target user first, then verifies it belongs to the
// caller's tenant before proceeding — returning the same 404 a genuinely
// nonexistent id would, so a numeric-id guess can't distinguish "wrong
// tenant" from "doesn't exist" (no cross-tenant enumeration signal).
async function findOwnedUser(id, tenantId) {
  const user = await userRepository.findById(id);
  if (!user || user.tenant_id !== tenantId) throw new ApiError(404, 'User not found');
  return user;
}

async function assertNoConflict(tenantId, { email, username, phone }, excludeId = null) {
  const conflict = await userRepository.findConflict(tenantId, { email, username, phone }, excludeId);
  if (!conflict) return;

  if (conflict.email === email) throw new ApiError(409, 'A user with this email already exists');
  if (conflict.username === username) throw new ApiError(409, 'A user with this username already exists');
  throw new ApiError(409, 'A user with this phone number already exists');
}

export async function listUsers(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await userRepository.findAll({
    tenantId,
    page,
    limit,
    search: query.search,
    roleId: query.roleId ? Number(query.roleId) : undefined,
    branchId: query.branchId ? Number(query.branchId) : undefined,
    status: query.status,
  });

  return {
    data: rows.map(sanitize),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getUser(id, tenantId) {
  const user = await findOwnedUser(id, tenantId);
  const branchIds = await userRepository.getBranchIds(id);
  return { ...sanitize(user), branchIds };
}

export async function createUser(data, actorId, tenantId) {
  await assertNoConflict(tenantId, { email: data.email, username: data.username, phone: data.phone });

  const role = await roleRepository.findById(data.roleId);
  if (!role) throw new ApiError(400, 'Selected role does not exist');

  const passwordHash = await hashPassword(data.password);
  const user = await userRepository.create({
    tenantId,
    firstName: data.firstName,
    lastName: data.lastName,
    gender: data.gender,
    phone: data.phone,
    email: data.email,
    username: data.username,
    passwordHash,
    roleId: data.roleId,
    branchId: data.branchId || null,
    status: data.status,
  });

  if (data.branchIds?.length) {
    await userRepository.setBranches(user.id, data.branchIds);
  }

  await activityLogRepository.create({
    userId: actorId,
    branchId: data.branchId || null,
    description: `User "${user.first_name} ${user.last_name}" created`,
    referenceType: 'user',
    referenceId: user.id,
  });

  return getUser(user.id, tenantId);
}

export async function updateUser(id, data, actorId, tenantId) {
  await findOwnedUser(id, tenantId);

  await assertNoConflict(tenantId, { email: data.email, username: data.username, phone: data.phone }, id);

  const role = await roleRepository.findById(data.roleId);
  if (!role) throw new ApiError(400, 'Selected role does not exist');

  await userRepository.update(id, tenantId, {
    firstName: data.firstName,
    lastName: data.lastName,
    gender: data.gender,
    phone: data.phone,
    email: data.email,
    username: data.username,
    roleId: data.roleId,
    branchId: data.branchId || null,
    userId: actorId,
  });

  if (data.branchIds) {
    await userRepository.setBranches(id, data.branchIds);
  }

  await activityLogRepository.create({
    userId: actorId,
    branchId: data.branchId || null,
    description: `User "${data.firstName} ${data.lastName}" updated`,
    referenceType: 'user',
    referenceId: id,
  });

  return getUser(id, tenantId);
}

export async function changeStatus(id, status, actorId, tenantId) {
  if (id === actorId) {
    throw new ApiError(400, 'You cannot change the status of your own account');
  }

  const existing = await findOwnedUser(id, tenantId);

  const user = await userRepository.updateStatus(id, status, actorId);
  await activityLogRepository.create({
    userId: actorId,
    branchId: existing.branch_id,
    description: `User "${existing.first_name} ${existing.last_name}" status changed to ${status}`,
    referenceType: 'user',
    referenceId: id,
  });

  return sanitize(user);
}

export async function adminResetPassword(id, newPassword, actorId, tenantId) {
  const existing = await findOwnedUser(id, tenantId);

  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePasswordHash(id, passwordHash);
  await activityLogRepository.create({
    userId: actorId,
    branchId: existing.branch_id,
    description: `Password reset by administrator for "${existing.first_name} ${existing.last_name}"`,
    referenceType: 'user',
    referenceId: id,
  });
}

export async function deleteUser(id, actorId, tenantId) {
  if (id === actorId) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  const existing = await findOwnedUser(id, tenantId);

  await userRepository.softDelete(id, actorId);
  await activityLogRepository.create({
    userId: actorId,
    branchId: existing.branch_id,
    description: `User "${existing.first_name} ${existing.last_name}" deleted`,
    referenceType: 'user',
    referenceId: id,
  });
}

export async function updateAvatar(id, file, tenantId) {
  await findOwnedUser(id, tenantId);

  const avatarPath = resolveUploadedFileUrl(file, 'avatars');
  const user = await userRepository.updateAvatarPath(id, avatarPath);
  return sanitize(user);
}
