import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as platformTenantService from '../services/platformTenant.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await platformTenantService.listTenants(req.query);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const detail = await platformTenantService.getTenantDetail(Number(req.params.id));
  return success(res, { data: detail });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { items, meta } = await platformTenantService.listTenantUsers(Number(req.params.id), req.query);
  return success(res, { data: { items, meta } });
});

export const suspend = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.suspendTenant(Number(req.params.id), req.platformAdmin, req.ip, req.body.reason);
  return success(res, { message: 'Tenant suspended', data: tenant });
});

export const activate = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.activateTenant(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Tenant activated', data: tenant });
});

export const extendTrial = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.extendTrial(Number(req.params.id), Number(req.body.days), req.platformAdmin, req.ip);
  return success(res, { message: 'Trial extended', data: tenant });
});

export const reduceTrial = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.reduceTrial(Number(req.params.id), Number(req.body.days), req.platformAdmin, req.ip);
  return success(res, { message: 'Trial reduced', data: tenant });
});

export const resetTrial = asyncHandler(async (req, res) => {
  const days = req.body.days ? Number(req.body.days) : undefined;
  const tenant = await platformTenantService.resetTrial(Number(req.params.id), days, req.platformAdmin, req.ip);
  return success(res, { message: 'Trial reset', data: tenant });
});

export const activateSubscription = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.activateSubscriptionManually(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Subscription activated', data: tenant });
});

export const expireImmediately = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.expireImmediately(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Trial expired', data: tenant });
});
