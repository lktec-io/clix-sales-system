import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as platformDashboardService from '../services/platformDashboard.service.js';

export const getKpis = asyncHandler(async (req, res) => {
  const data = await platformDashboardService.getKpis();
  return success(res, { data });
});

export const getSystemStatus = asyncHandler(async (req, res) => {
  const data = await platformDashboardService.getSystemStatus();
  return success(res, { data });
});

export const getStorageUsage = asyncHandler(async (req, res) => {
  const data = await platformDashboardService.getStorageUsage();
  return success(res, { data });
});

export const getRecentActivity = asyncHandler(async (req, res) => {
  const data = await platformDashboardService.getRecentActivity(Number(req.query.limit) || 20);
  return success(res, { data });
});

export const getBillingKpis = asyncHandler(async (req, res) => {
  const data = await platformDashboardService.getBillingKpis();
  return success(res, { data });
});
