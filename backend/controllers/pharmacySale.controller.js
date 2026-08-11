import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as pharmacySaleService from '../services/pharmacySale.service.js';

export const summary = asyncHandler(async (req, res) => {
  const data = await pharmacySaleService.getSalesSummary(req.user);
  return success(res, { data });
});

export const recent = asyncHandler(async (req, res) => {
  const data = await pharmacySaleService.getRecentSales(req.user, req.query.limit ? Number(req.query.limit) : undefined);
  return success(res, { data });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await pharmacySaleService.listSales(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const sale = await pharmacySaleService.getSale(Number(req.params.id), req.user.tenantId);
  return success(res, { data: sale });
});

export const create = asyncHandler(async (req, res) => {
  const sale = await pharmacySaleService.sellMedicines(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Sale completed', data: sale, status: 201 });
});
