import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isModuleEnabledForTenant } from '../services/moduleResolution.service.js';

// Appended as a third argument to an existing route file's top-level
// `router.use(authenticate, authorize('<code>.view'), requireModule('<key>'))`
// — authenticate has already populated req.user.tenantId in that same
// call, so this never re-verifies the token or re-resolves the tenant.
// Modules narrow what a request that ALREADY passed authenticate+authorize
// may reach; they never widen it and never replace the permission check
// that already ran (Step 12).
export function requireModule(moduleKey) {
  return asyncHandler(async (req, res, next) => {
    const enabled = await isModuleEnabledForTenant(req.user.tenantId, moduleKey);
    if (!enabled) {
      throw new ApiError(403, 'This module is not enabled for your organization.');
    }
    return next();
  });
}
