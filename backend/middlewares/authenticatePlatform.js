// Sibling to authenticate.js, not a variant of it — deliberately imports
// nothing from authenticate.js or tenantContext.js, so there is no shared
// code path a bug in one could let leak into the other. A tenant-issued
// JWT fails verifyPlatformAccessToken() outright (signed with a different
// secret, see utils/platformTokenUtils.js) before any further check runs.
import { verifyPlatformAccessToken } from '../utils/platformTokenUtils.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../config/logger.js';
import * as platformAdminRepository from '../repositories/platformAdmin.repository.js';

export const authenticatePlatform = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = verifyPlatformAccessToken(token);
  } catch (err) {
    logger.warn('Platform access token verification failed', {
      reason: err.name,
      message: err.message,
      path: req.originalUrl,
    });
    throw new ApiError(401, 'Invalid or expired access token');
  }

  const admin = await platformAdminRepository.findById(payload.sub);
  if (!admin || admin.status !== 'active') {
    throw new ApiError(401, 'Invalid or expired access token');
  }

  req.platformAdmin = {
    id: admin.id,
    firstName: admin.first_name,
    lastName: admin.last_name,
    email: admin.email,
  };
  return next();
});
