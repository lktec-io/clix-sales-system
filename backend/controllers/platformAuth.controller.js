import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import * as platformAuthService from '../services/platformAuth.service.js';

const REFRESH_COOKIE_NAME = 'platformRefreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/platform/auth';

function setRefreshCookie(res, token, expiresAt) {
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
  const { email, password } = req.body;

  const result = await platformAuthService.login({
    email,
    password,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  return success(res, { message: 'Login successful', data: { accessToken: result.accessToken, admin: result.admin } });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const result = await platformAuthService.refresh({ refreshToken });
  setRefreshCookie(res, result.refreshToken, undefined);
  return success(res, { message: 'Token refreshed', data: { accessToken: result.accessToken, admin: result.admin } });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await platformAuthService.logout({ refreshToken });
  clearRefreshCookie(res);
  return success(res, { message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  const admin = await platformAuthService.getMe(req.platformAdmin.id);
  return success(res, { data: admin });
});
