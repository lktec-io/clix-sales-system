import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as returnService from '../services/return.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await returnService.listReturns(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const returnRecord = await returnService.getReturn(Number(req.params.id), req.user.tenantId);
  return success(res, { data: returnRecord });
});

export const create = asyncHandler(async (req, res) => {
  const returnRecord = await returnService.createReturn(req.body, req.user.id, req.user);
  return success(res, { message: 'Return requested', data: returnRecord, status: 201 });
});

export const approve = asyncHandler(async (req, res) => {
  const returnRecord = await returnService.approveReturn(Number(req.params.id), req.user.id, req.user);
  return success(res, { message: 'Return approved, inventory restored and refund issued', data: returnRecord });
});

export const reject = asyncHandler(async (req, res) => {
  const returnRecord = await returnService.rejectReturn(Number(req.params.id), req.user.id, req.user);
  return success(res, { message: 'Return rejected', data: returnRecord });
});
