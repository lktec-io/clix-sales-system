import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as companyService from '../services/company.service.js';

export const getCompany = asyncHandler(async (req, res) => {
  const profile = await companyService.getProfile(req.user.tenantId);
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
