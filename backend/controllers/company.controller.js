import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as companyService from '../services/company.service.js';

export const getCompany = asyncHandler(async (req, res) => {
  // req.user is only set when a valid token was presented (see
  // authenticateOptional in company.routes.js) — an anonymous caller (the
  // login page, before any session exists) has no tenant to resolve a
  // profile for, so it gets null rather than another tenant's data or a crash.
  const profile = req.user ? await companyService.getProfile(req.user.tenantId) : null;
  return success(res, { data: profile });
});

export const updateCompany = asyncHandler(async (req, res) => {
  const profile = await companyService.upsertProfile(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Company profile saved', data: profile });
});

export const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No logo file uploaded');
  }
  const profile = await companyService.updateLogo(req.file, req.user.id, req.user.tenantId);
  return success(res, { message: 'Logo updated', data: profile });
});
