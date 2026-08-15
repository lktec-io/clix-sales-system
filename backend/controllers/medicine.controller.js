import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as medicineService from '../services/medicine.service.js';
import * as medicineRepository from '../repositories/medicine.repository.js';

export const listActive = asyncHandler(async (req, res) => {
  const medicines = await medicineRepository.findAllActive(req.user.tenantId);
  return success(res, { data: medicines });
});

export const dashboardSummary = asyncHandler(async (req, res) => {
  const summary = await medicineService.getDashboardSummary(req.user);
  return success(res, { data: summary });
});

export const listExpiring = asyncHandler(async (req, res) => {
  const { items, meta } = await medicineService.listExpiring(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const sellable = asyncHandler(async (req, res) => {
  const medicines = await medicineService.getSellableMedicines(req.query, req.user);
  return success(res, { data: medicines });
});

export const lookupByBarcode = asyncHandler(async (req, res) => {
  const medicine = await medicineService.getSellableMedicineByBarcode(req.query, req.user);
  return success(res, { data: medicine });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await medicineService.listMedicines(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const medicine = await medicineService.getMedicine(Number(req.params.id), req.user.tenantId);
  return success(res, { data: medicine });
});

export const create = asyncHandler(async (req, res) => {
  const medicine = await medicineService.createMedicine(req.body, req.user.id, req.user.tenantId, req.user);
  return success(res, { message: 'Medicine created', data: medicine, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const medicine = await medicineService.updateMedicine(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Medicine updated', data: medicine });
});

export const remove = asyncHandler(async (req, res) => {
  await medicineService.deleteMedicine(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Medicine deleted' });
});
