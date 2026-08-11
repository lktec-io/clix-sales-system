import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as menuItemService from '../services/menuItem.service.js';
import * as menuItemRepository from '../repositories/menuItem.repository.js';

export const listActive = asyncHandler(async (req, res) => {
  const items = await menuItemRepository.findAllActive(req.user.tenantId);
  return success(res, { data: items });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await menuItemService.listMenuItems(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const item = await menuItemService.getMenuItem(Number(req.params.id), req.user.tenantId);
  return success(res, { data: item });
});

export const create = asyncHandler(async (req, res) => {
  const item = await menuItemService.createMenuItem(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Menu item created', data: item, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const item = await menuItemService.updateMenuItem(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Menu item updated', data: item });
});

export const remove = asyncHandler(async (req, res) => {
  await menuItemService.deleteMenuItem(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Menu item deleted' });
});
