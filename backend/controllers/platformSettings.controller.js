import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as platformSettingsService from '../services/platformSettings.service.js';

export const getSettings = asyncHandler(async (req, res) => {
  const data = await platformSettingsService.getSettings();
  return success(res, { data });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const data = await platformSettingsService.updateSettings(req.body, req.platformAdmin.id);
  return success(res, { message: 'Settings updated', data });
});
