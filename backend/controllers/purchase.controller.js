import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as purchaseService from '../services/purchase.service.js';
import * as purchaseImportService from '../services/purchaseImport.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await purchaseService.listPurchases(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.getPurchase(Number(req.params.id), req.user.tenantId);
  return success(res, { data: purchase });
});

export const create = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.createPurchase(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Purchase recorded and inventory updated', data: purchase, status: 201 });
});

export const addPayment = asyncHandler(async (req, res) => {
  await purchaseService.addPayment(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Payment recorded', status: 201 });
});

export const downloadImportTemplate = asyncHandler(async (req, res) => {
  const workbook = await purchaseImportService.buildImportTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Purchase_Import_Template.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

export const previewImport = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Upload an Excel (.xlsx) file');

  // Always memoryStorage (createSpreadsheetUploader), so req.file.buffer is
  // populated regardless of whether Cloudinary is configured — unlike the
  // image uploader, there's no disk-storage path to fall back to here.
  const rawRows = await purchaseImportService.parseImportFile(req.file.buffer);
  const { rows, summary } = await purchaseImportService.validateRows(rawRows, req.user.tenantId);
  return success(res, { data: { rows, summary } });
});

export const commitImport = asyncHandler(async (req, res) => {
  const result = await purchaseImportService.commitImport(req.body.rows, { branchId: Number(req.body.branchId) }, req.user.id, req.user.tenantId);
  return success(res, { message: 'Import complete', data: result, status: 201 });
});
