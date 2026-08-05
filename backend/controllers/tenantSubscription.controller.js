import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as tenantSubscriptionService from '../services/tenantSubscription.service.js';

export const getMySubscription = asyncHandler(async (req, res) => {
  const data = await tenantSubscriptionService.getForTenant(req.user.tenantId);
  return success(res, { data });
});

export const getMyHistory = asyncHandler(async (req, res) => {
  const { items, meta } = await tenantSubscriptionService.listHistoryForTenant(req.user.tenantId, req.query);
  return success(res, { data: { items, meta } });
});
