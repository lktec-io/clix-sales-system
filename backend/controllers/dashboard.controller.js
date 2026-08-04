import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as dashboardService from '../services/dashboard.service.js';

export const getKpis = asyncHandler(async (req, res) => {
  const kpis = await dashboardService.getKpis(req.user);
  return success(res, { data: kpis });
});

export const getChart = asyncHandler(async (req, res) => {
  const data = await dashboardService.getChart(req.user, req.params.type, req.query);
  return success(res, { data });
});

export const getActivity = asyncHandler(async (req, res) => {
  const activity = await dashboardService.getActivity(req.user.tenantId, Number(req.query.limit) || 20);
  return success(res, { data: activity });
});

export const getSystemStatus = asyncHandler(async (req, res) => {
  const status = await dashboardService.getSystemStatus(req.user.tenantId);
  return success(res, { data: status });
});
