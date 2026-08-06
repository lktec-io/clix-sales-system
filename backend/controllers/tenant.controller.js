import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { logger } from '../config/logger.js';
import * as tenantService from '../services/tenant.service.js';
import * as businessTemplateAssignmentService from '../services/businessTemplateAssignment.service.js';
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

  // Phase 5 — additive, best-effort: assigns Retail Store (the platform
  // default) to every new tenant. tenant.service.js/tenant.repository.js
  // are never touched — this runs entirely after register()'s own
  // transaction has already committed, exactly like its welcome email and
  // activity log. A failure here never blocks a successful registration
  // response; the tenant simply resolves to "no modules configured yet"
  // until a platform admin (or a retry) assigns one.
  try {
    await businessTemplateAssignmentService.assignDefault(result.user.tenant_id);
  } catch (err) {
    logger.error('Failed to assign default business template at registration', { message: err.message, tenantId: result.user.tenant_id });
  }

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
