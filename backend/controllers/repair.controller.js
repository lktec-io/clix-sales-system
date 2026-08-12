import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as repairService from '../services/repair.service.js';

export const summary = asyncHandler(async (req, res) => {
  const data = await repairService.getDashboardSummary(req.user);
  return success(res, { data });
});

export const recent = asyncHandler(async (req, res) => {
  const data = await repairService.getRecentRepairs(req.user, req.query.limit ? Number(req.query.limit) : undefined);
  return success(res, { data });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await repairService.listRepairs(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const repair = await repairService.getRepair(Number(req.params.id), req.user.tenantId);
  return success(res, { data: repair });
});

export const create = asyncHandler(async (req, res) => {
  const repair = await repairService.createIntake(req.body, req.user.id, req.user.tenantId, req.user);
  return success(res, { message: 'Repair intake created', data: repair, status: 201 });
});

export const updateDiagnosis = asyncHandler(async (req, res) => {
  const repair = await repairService.updateDiagnosis(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Diagnosis updated', data: repair });
});

export const assignTechnician = asyncHandler(async (req, res) => {
  const repair = await repairService.assignTechnician(Number(req.params.id), Number(req.body.technicianId), req.user.id, req.user.tenantId);
  return success(res, { message: 'Technician assigned', data: repair });
});

export const startDiagnosis = asyncHandler(async (req, res) => {
  const repair = await repairService.startDiagnosis(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Diagnosis started', data: repair });
});

export const sendForApproval = asyncHandler(async (req, res) => {
  const repair = await repairService.sendForApproval(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Sent for customer approval', data: repair });
});

export const markUnrepairable = asyncHandler(async (req, res) => {
  const repair = await repairService.markUnrepairable(Number(req.params.id), req.body.notes, req.user.id, req.user.tenantId);
  return success(res, { message: 'Marked unrepairable', data: repair });
});

export const approve = asyncHandler(async (req, res) => {
  const repair = await repairService.approve(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Repair approved', data: repair });
});

export const reject = asyncHandler(async (req, res) => {
  const repair = await repairService.reject(Number(req.params.id), req.body.notes, req.user.id, req.user.tenantId);
  return success(res, { message: 'Repair rejected', data: repair });
});

export const startRepair = asyncHandler(async (req, res) => {
  const repair = await repairService.startRepair(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Repair started', data: repair });
});

export const addPart = asyncHandler(async (req, res) => {
  const repair = await repairService.addPart(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Part added', data: repair, status: 201 });
});

export const markReady = asyncHandler(async (req, res) => {
  const repair = await repairService.markReady(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Marked ready for collection', data: repair });
});

export const recordPayment = asyncHandler(async (req, res) => {
  const repair = await repairService.recordPayment(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Payment recorded', data: repair, status: 201 });
});

export const completeCollection = asyncHandler(async (req, res) => {
  const repair = await repairService.completeCollection(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Repair completed', data: repair });
});

export const cancel = asyncHandler(async (req, res) => {
  const repair = await repairService.cancelRepair(Number(req.params.id), req.body.notes, req.user.id, req.user.tenantId);
  return success(res, { message: 'Repair cancelled', data: repair });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const result = await repairService.sendCustomMessage(Number(req.params.id), req.body.message, req.user.id, req.user.tenantId);
  return success(res, { message: 'Message queued', data: result, status: 201 });
});

export const smsHistory = asyncHandler(async (req, res) => {
  const data = await repairService.getSmsHistory(Number(req.params.id), req.user.tenantId);
  return success(res, { data });
});
