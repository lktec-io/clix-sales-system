import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as customerService from '../services/customer.service.js';

export const listActive = asyncHandler(async (req, res) => {
  const customers = await customerRepository.findAllActive(req.user.tenantId);
  return success(res, { data: customers });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await customerService.listCustomers(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomer(Number(req.params.id), req.user.tenantId);
  return success(res, { data: customer });
});

export const purchaseHistory = asyncHandler(async (req, res) => {
  const { items, meta } = await customerService.getPurchaseHistory(Number(req.params.id), req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const returnHistory = asyncHandler(async (req, res) => {
  const { items, meta } = await customerService.getReturnHistory(Number(req.params.id), req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const create = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Customer created', data: customer, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Customer updated', data: customer });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const customer = await customerService.changeStatus(Number(req.params.id), req.body.status, req.user.id, req.user.tenantId);
  return success(res, { message: 'Customer status updated', data: customer });
});

export const remove = asyncHandler(async (req, res) => {
  await customerService.deleteCustomer(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Customer deleted' });
});
