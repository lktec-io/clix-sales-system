import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as branchService from '../services/branch.service.js';

// Minimal read-only lookup used by dropdowns across the app.
export const listActive = asyncHandler(async (req, res) => {
  const branches = await branchRepository.findAllActive(req.user.tenantId);
  return success(res, { data: branches });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await branchService.listBranches(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const branch = await branchService.getBranch(Number(req.params.id), req.user.tenantId);
  return success(res, { data: branch });
});

export const create = asyncHandler(async (req, res) => {
  const branch = await branchService.createBranch(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Branch created', data: branch, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const branch = await branchService.updateBranch(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Branch updated', data: branch });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const branch = await branchService.changeStatus(Number(req.params.id), req.body.status, req.user.id, req.user.tenantId);
  return success(res, { message: 'Branch status updated', data: branch });
});
