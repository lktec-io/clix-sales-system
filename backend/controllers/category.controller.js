import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as categoryRepository from '../repositories/category.repository.js';
import * as categoryService from '../services/category.service.js';

export const listActive = asyncHandler(async (req, res) => {
  const categories = await categoryRepository.findAllActive(req.user.tenantId);
  return success(res, { data: categories });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await categoryService.listCategories(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const create = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Category created', data: category, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Category updated', data: category });
});

export const remove = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Category deleted' });
});
