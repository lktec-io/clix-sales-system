import { verifyAccessToken } from '../utils/tokenUtils.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../config/logger.js';
import { resolveTenant } from './tenantContext.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    // The client only ever sees the generic message below; the specific
    // jsonwebtoken reason (TokenExpiredError vs JsonWebTokenError vs a
    // wrong-secret signature mismatch) is logged here so intermittent
    // auth failures are diagnosable from server logs instead of a guess.
    logger.warn('Access token verification failed', {
      reason: err.name,
      message: err.message,
      path: req.originalUrl,
    });
    throw new ApiError(401, 'Invalid or expired access token');
  }

  // Deliberately outside the try/catch above — a suspended/invalid tenant
  // (resolveTenant, tenantContext.js) is a real, distinct 403, not a token
  // problem, and must never be reported to the client as "Invalid or
  // expired access token". tenant_id reaches the app ONLY from this signed
  // JWT claim, never from client-supplied request data.
  const tenant = await resolveTenant(payload.tenantId);

  req.user = { id: payload.sub, tenantId: tenant.id, roleId: payload.roleId, role: payload.role, branchId: payload.branchId };
  req.tenantId = tenant.id;
  // Full tenant row (not just the id) — resolveTenant() already fetched it
  // above, so this is free. Phase 2's requireActiveTrial.js and the
  // GET /tenants/me endpoint read this directly instead of re-querying.
  req.tenant = tenant;
  return next();
});

// For the handful of routes that must serve BOTH a logged-out caller (the
// login page rendering company branding before any session exists) and a
// logged-in one (the same endpoint, Settings > Company Profile) from a
// single handler. Unlike authenticate() above, a missing/invalid token is
// not an error here — req.user/req.tenant are simply left unset and the
// controller decides what an anonymous caller gets to see. A tenant_id is
// still only ever taken from a verified JWT claim, never guessed.
export const authenticateOptional = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next();
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next();
  }

  try {
    const tenant = await resolveTenant(payload.tenantId);
    req.user = { id: payload.sub, tenantId: tenant.id, roleId: payload.roleId, role: payload.role, branchId: payload.branchId };
    req.tenantId = tenant.id;
    req.tenant = tenant;
  } catch {
    // Suspended tenant, deleted tenant, etc. — treat as anonymous rather
    // than failing a route that's supposed to degrade gracefully.
  }
  return next();
});
