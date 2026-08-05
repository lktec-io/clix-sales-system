import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as tenantSubscriptionService from '../services/tenantSubscription.service.js';
import * as subscriptionLifecycleService from '../services/subscriptionLifecycle.service.js';

export const getForTenant = asyncHandler(async (req, res) => {
  const data = await tenantSubscriptionService.getForTenant(Number(req.params.tenantId));
  return success(res, { data });
});

export const getHistoryForTenant = asyncHandler(async (req, res) => {
  const { items, meta } = await tenantSubscriptionService.listHistoryForTenant(Number(req.params.tenantId), req.query);
  return success(res, { data: { items, meta } });
});

export const upgrade = asyncHandler(async (req, res) => {
  const result = await subscriptionLifecycleService.upgradePlan(Number(req.params.tenantId), req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Plan upgraded', data: result });
});

export const downgrade = asyncHandler(async (req, res) => {
  const result = await subscriptionLifecycleService.downgradePlan(Number(req.params.tenantId), req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Plan downgraded', data: result });
});

export const renew = asyncHandler(async (req, res) => {
  const result = await subscriptionLifecycleService.renewSubscription(Number(req.params.tenantId), req.platformAdmin, req.ip);
  return success(res, { message: 'Subscription renewed', data: result });
});

export const cancel = asyncHandler(async (req, res) => {
  const data = await subscriptionLifecycleService.cancelSubscription(Number(req.params.tenantId), req.body.reason, req.platformAdmin, req.ip);
  return success(res, { message: 'Subscription cancelled', data });
});

export const resume = asyncHandler(async (req, res) => {
  const data = await subscriptionLifecycleService.resumeSubscription(Number(req.params.tenantId), req.platformAdmin, req.ip);
  return success(res, { message: 'Subscription resumed', data });
});

export const schedule = asyncHandler(async (req, res) => {
  const data = await subscriptionLifecycleService.scheduleplanChange(Number(req.params.tenantId), req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Plan change scheduled', data });
});

export const generateInvoiceForTenant = asyncHandler(async (req, res) => {
  const data = await subscriptionLifecycleService.generateInvoice(Number(req.params.tenantId), req.platformAdmin, req.ip);
  return success(res, { message: 'Invoice generated', data, status: 201 });
});
