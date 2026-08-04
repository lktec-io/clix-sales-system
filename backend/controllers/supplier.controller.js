import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as supplierRepository from '../repositories/supplier.repository.js';
import * as supplierService from '../services/supplier.service.js';

export const listActive = asyncHandler(async (req, res) => {
  const suppliers = await supplierRepository.findAllActive(req.user.tenantId);
  return success(res, { data: suppliers });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await supplierService.listSuppliers(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const supplier = await supplierService.getSupplier(Number(req.params.id), req.user.tenantId);
  return success(res, { data: supplier });
});

export const purchaseHistory = asyncHandler(async (req, res) => {
  const { items, meta } = await supplierService.getPurchaseHistory(Number(req.params.id), req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const create = asyncHandler(async (req, res) => {
  const supplier = await supplierService.createSupplier(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Supplier created', data: supplier, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const supplier = await supplierService.updateSupplier(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Supplier updated', data: supplier });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const supplier = await supplierService.changeStatus(Number(req.params.id), req.body.status, req.user.id, req.user.tenantId);
  return success(res, { message: 'Supplier status updated', data: supplier });
});

export const remove = asyncHandler(async (req, res) => {
  await supplierService.deleteSupplier(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Supplier deleted' });
});
