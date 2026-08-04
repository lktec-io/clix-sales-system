import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as brandRepository from '../repositories/brand.repository.js';
import * as brandService from '../services/brand.service.js';

export const listActive = asyncHandler(async (req, res) => {
  const brands = await brandRepository.findAllActive(req.user.tenantId);
  return success(res, { data: brands });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await brandService.listBrands(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const create = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Brand created', data: brand, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Brand updated', data: brand });
});

export const remove = asyncHandler(async (req, res) => {
  await brandService.deleteBrand(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Brand deleted' });
});
