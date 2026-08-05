import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as tenantService from '../services/tenant.service.js';
import { setRefreshCookie } from './auth.controller.js';

export const register = asyncHandler(async (req, res) => {
  const {
    companyName, ownerFirstName, ownerLastName, businessEmail, phone,
    password, businessType, country,
  } = req.body;

  const result = await tenantService.register({
    companyName,
    ownerFirstName,
    ownerLastName,
    businessEmail,
    phone,
    password,
    businessType,
    country,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  return success(res, {
    message: 'Welcome to Clix Sales System — your 14-day free trial has started.',
    data: { accessToken: result.accessToken, user: result.user },
    status: 201,
  });
});

// Read-only, authenticate-only (no permission gate — every logged-in user
// may see their own tenant's trial status). req.tenant is already populated
// by authenticate.js's resolveTenant() call, so this costs no extra query.
export const getMyTenant = asyncHandler(async (req, res) => {
  const data = await tenantService.getMyTenant(req.tenant);
  return success(res, { data });
});
