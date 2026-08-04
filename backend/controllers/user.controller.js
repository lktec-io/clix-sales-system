import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as userService from '../services/user.service.js';

export const list = asyncHandler(async (req, res) => {
  const { data: items, meta } = await userService.listUsers(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUser(Number(req.params.id), req.user.tenantId);
  return success(res, { data: user });
});

export const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'User created', data: user, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'User updated', data: user });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const user = await userService.changeStatus(Number(req.params.id), req.body.status, req.user.id, req.user.tenantId);
  return success(res, { message: 'User status updated', data: user });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await userService.adminResetPassword(Number(req.params.id), req.body.newPassword, req.user.id, req.user.tenantId);
  return success(res, { message: 'Password reset successfully' });
});

export const remove = asyncHandler(async (req, res) => {
  await userService.deleteUser(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'User deleted' });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No avatar file uploaded');
  }
  const user = await userService.updateAvatar(Number(req.params.id), req.file, req.user.tenantId);
  return success(res, { message: 'Avatar updated', data: user });
});
