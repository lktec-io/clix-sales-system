import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as subscriptionPlanService from '../services/subscriptionPlan.service.js';

export const listPublic = asyncHandler(async (req, res) => {
  const data = await subscriptionPlanService.listPublicPlans();
  return success(res, { data });
});

export const list = asyncHandler(async (req, res) => {
  const data = await subscriptionPlanService.listForAdmin();
  return success(res, { data });
});

export const getById = asyncHandler(async (req, res) => {
  const data = await subscriptionPlanService.getById(Number(req.params.id));
  return success(res, { data });
});

export const create = asyncHandler(async (req, res) => {
  const plan = await subscriptionPlanService.createPlan(req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Plan created', data: plan, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const plan = await subscriptionPlanService.updatePlan(Number(req.params.id), req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Plan updated', data: plan });
});

export const activate = asyncHandler(async (req, res) => {
  const plan = await subscriptionPlanService.activatePlan(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Plan activated', data: plan });
});

export const deactivate = asyncHandler(async (req, res) => {
  const plan = await subscriptionPlanService.deactivatePlan(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Plan deactivated', data: plan });
});

export const markRecommended = asyncHandler(async (req, res) => {
  const plan = await subscriptionPlanService.markRecommended(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Plan marked as recommended', data: plan });
});

export const reorder = asyncHandler(async (req, res) => {
  const plans = await subscriptionPlanService.reorderPlans(req.body.orderedIds, req.platformAdmin, req.ip);
  return success(res, { message: 'Plans reordered', data: plans });
});
