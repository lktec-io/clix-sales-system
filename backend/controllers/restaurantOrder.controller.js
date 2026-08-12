import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as restaurantOrderService from '../services/restaurantOrder.service.js';

export const summary = asyncHandler(async (req, res) => {
  const data = await restaurantOrderService.getSalesSummary(req.user);
  return success(res, { data });
});

export const recent = asyncHandler(async (req, res) => {
  const data = await restaurantOrderService.getRecentOrders(req.user, req.query.limit ? Number(req.query.limit) : undefined);
  return success(res, { data });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await restaurantOrderService.listOrders(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const order = await restaurantOrderService.getOrder(Number(req.params.id), req.user.tenantId);
  return success(res, { data: order });
});

export const create = asyncHandler(async (req, res) => {
  const order = await restaurantOrderService.createOrder(req.body, req.user.id, req.user.tenantId, req.user);
  return success(res, { message: 'Order opened', data: order, status: 201 });
});

export const sendToKitchen = asyncHandler(async (req, res) => {
  const order = await restaurantOrderService.sendToKitchen(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Order sent to kitchen', data: order });
});

export const markServed = asyncHandler(async (req, res) => {
  const order = await restaurantOrderService.markServed(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Order served', data: order });
});

export const recordPayment = asyncHandler(async (req, res) => {
  const order = await restaurantOrderService.recordPaymentAndComplete(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Payment recorded and order closed', data: order });
});

export const cancel = asyncHandler(async (req, res) => {
  const order = await restaurantOrderService.cancelOrder(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Order cancelled', data: order });
});
