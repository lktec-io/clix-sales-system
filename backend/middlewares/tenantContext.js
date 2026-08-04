import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as tenantRepository from '../repositories/tenant.repository.js';

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // tenantId -> { tenant, expiresAt }

// Cached lookup — mirrors backend/middlewares/authorize.js's permission
// cache exactly (same TTL, same Map-per-process shape) — so tenant
// resolution doesn't cost a DB round trip on every single authenticated
// request, while a newly-suspended tenant still takes effect within one
// TTL window (same staleness trade-off the permission cache already
// accepts). Throws rather than returning null/undefined so every call site
// fails closed by construction.
export async function resolveTenant(tenantId) {
  if (!tenantId) {
    throw new ApiError(403, 'No organization is associated with this account.');
  }

  const cached = cache.get(tenantId);
  const tenant = cached && cached.expiresAt > Date.now() ? cached.tenant : await tenantRepository.findById(tenantId);

  if (!tenant) {
    throw new ApiError(403, 'Invalid organization.');
  }
  if (!cached || cached.expiresAt <= Date.now()) {
    cache.set(tenantId, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  if (tenant.status !== 'active') {
    throw new ApiError(403, "This account's organization is not active. Contact support.");
  }

  return tenant;
}

// Invalidate on tenant status changes (mirrors authorize.js's
// invalidatePermissionCache — no such admin UI exists yet, wired for when
// one does).
export function invalidateTenantCache(tenantId) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

// Standalone Express middleware, kept for reusability even though the
// current wiring calls resolveTenant() directly from authenticate.js (the
// one chokepoint every protected request already passes through — no
// router calls authorize() without authenticate first). Not mounted
// anywhere today; available if a future route needs to re-validate tenant
// context independently.
export const tenantContext = asyncHandler(async (req, res, next) => {
  const tenant = await resolveTenant(req.user?.tenantId);
  req.tenantId = tenant.id;
  if (req.user) req.user.tenantId = tenant.id;
  return next();
});
