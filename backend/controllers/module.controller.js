import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as moduleService from '../services/module.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await moduleService.listForAdmin();
  return success(res, { data });
});

export const getById = asyncHandler(async (req, res) => {
  const data = await moduleService.getById(Number(req.params.id));
  return success(res, { data });
});

export const create = asyncHandler(async (req, res) => {
  const module = await moduleService.createModule(req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Module created', data: module, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const module = await moduleService.updateModule(Number(req.params.id), req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Module updated', data: module });
});

export const activate = asyncHandler(async (req, res) => {
  const module = await moduleService.activateModule(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Module activated', data: module });
});

export const deactivate = asyncHandler(async (req, res) => {
  const module = await moduleService.deactivateModule(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Module deactivated', data: module });
});
