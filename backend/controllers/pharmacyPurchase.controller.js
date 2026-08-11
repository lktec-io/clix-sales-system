import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as pharmacyPurchaseService from '../services/pharmacyPurchase.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await pharmacyPurchaseService.listPurchases(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const purchase = await pharmacyPurchaseService.getPurchase(Number(req.params.id), req.user.tenantId);
  return success(res, { data: purchase });
});

export const create = asyncHandler(async (req, res) => {
  const purchase = await pharmacyPurchaseService.receiveStock(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Stock received', data: purchase, status: 201 });
});
