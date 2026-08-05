import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';

// Exported for reuse by tenant.controller.js — self-registration's
// auto-login must set the identical refresh cookie shape login() does, so
// the existing refresh-token flow (apiClient.js's interceptor, /auth/refresh)
// keeps working unchanged for a session that started via registration.
export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

export const login = asyncHandler(async (req, res) => {
  const { identifier, password, rememberMe } = req.body;

  const result = await authService.login({
    identifier,
    password,
    rememberMe: Boolean(rememberMe),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  return success(res, { message: 'Login successful', data: { accessToken: result.accessToken, user: result.user } });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  const result = await authService.refresh({ refreshToken });

  setRefreshCookie(res, result.refreshToken, undefined);
  return success(res, { message: 'Token refreshed', data: { accessToken: result.accessToken, user: result.user } });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout({ refreshToken });
  clearRefreshCookie(res);
  return success(res, { message: 'Logged out' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  clearRefreshCookie(res);
  return success(res, { message: 'Logged out of all devices' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword({ email: req.body.email });
  return success(res, { message: 'If that email exists, a reset link has been sent' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword({ token: req.body.token, newPassword: req.body.newPassword });
  return success(res, { message: 'Password reset successfully. Please log in with your new password.' });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  return success(res, { data: user });
});

export const sessions = asyncHandler(async (req, res) => {
  const rows = await authService.listSessions(req.user.id);
  return success(res, { data: rows });
});

export const revokeSession = asyncHandler(async (req, res) => {
  await authService.revokeSession(req.user.id, Number(req.params.id));
  return success(res, { message: 'Session revoked' });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateOwnProfile(req.user.id, req.body);
  return success(res, { message: 'Profile updated', data: user });
});

export const updateLanguage = asyncHandler(async (req, res) => {
  const user = await authService.updateLanguagePreference(req.user.id, req.body.preferredLanguage);
  return success(res, { message: 'Language updated', data: user });
});

export const uploadProfileAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No avatar file uploaded');
  }
  const user = await userService.updateAvatar(req.user.id, req.file, req.user.tenantId);
  return success(res, { message: 'Avatar updated', data: user });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changeOwnPassword(req.user.id, {
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  clearRefreshCookie(res);
  return success(res, { message: 'Password changed. Please log in again.' });
});
