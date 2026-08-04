import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as transferService from '../services/transfer.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await transferService.listTransfers(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const transfer = await transferService.getTransfer(Number(req.params.id), req.user.tenantId);
  return success(res, { data: transfer });
});

export const create = asyncHandler(async (req, res) => {
  const transfer = await transferService.createTransfer(req.body, req.user.id, req.user);
  return success(res, { message: 'Transfer requested', data: transfer, status: 201 });
});

export const approve = asyncHandler(async (req, res) => {
  const transfer = await transferService.approveTransfer(Number(req.params.id), req.user.id, req.user);
  return success(res, { message: 'Transfer approved and inventory updated', data: transfer });
});

export const reject = asyncHandler(async (req, res) => {
  const transfer = await transferService.rejectTransfer(Number(req.params.id), req.user.id, req.user);
  return success(res, { message: 'Transfer rejected', data: transfer });
});
