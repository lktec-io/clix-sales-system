import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as restaurantTableService from '../services/restaurantTable.service.js';

export const listAvailable = asyncHandler(async (req, res) => {
  const tables = await restaurantTableService.listAvailableTables(req.user);
  return success(res, { data: tables });
});

export const summary = asyncHandler(async (req, res) => {
  const data = await restaurantTableService.getOccupancySummary(req.user);
  return success(res, { data });
});

export const list = asyncHandler(async (req, res) => {
  const tables = await restaurantTableService.listTables(req.query, req.user);
  return success(res, { data: tables });
});

export const getById = asyncHandler(async (req, res) => {
  const table = await restaurantTableService.getTable(Number(req.params.id), req.user.tenantId);
  return success(res, { data: table });
});

export const create = asyncHandler(async (req, res) => {
  const table = await restaurantTableService.createTable(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Table created', data: table, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const table = await restaurantTableService.updateTable(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Table updated', data: table });
});

export const setActive = asyncHandler(async (req, res) => {
  await restaurantTableService.setTableActive(Number(req.params.id), Boolean(req.body.isActive), req.user.id, req.user.tenantId);
  return success(res, { message: 'Table status updated' });
});

export const setStatus = asyncHandler(async (req, res) => {
  const table = await restaurantTableService.setTableStatus(Number(req.params.id), req.body.status, req.user.tenantId);
  return success(res, { message: 'Table status updated', data: table });
});
