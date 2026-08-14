import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as medicineImportService from '../services/medicineImport.service.js';

export const downloadImportTemplate = asyncHandler(async (req, res) => {
  const workbook = await medicineImportService.buildImportTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Medicine_Import_Template.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

export const previewImport = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Upload an Excel (.xlsx) file');

  // createSpreadsheetUploader always uses memoryStorage, so req.file.buffer
  // is populated regardless of whether Cloudinary is configured.
  const rawRows = await medicineImportService.parseImportFile(req.file.buffer);
  const { validRows, errors, totalRows } = await medicineImportService.validateRows(rawRows, req.user.tenantId);
  return success(res, { data: { validRows, errors, totalRows } });
});

export const commitImport = asyncHandler(async (req, res) => {
  const result = await medicineImportService.commitImport(
    req.body.rows,
    { branchId: Number(req.body.branchId) },
    req.user.id,
    req.user.tenantId,
    req.user,
  );
  return success(res, { message: 'Import complete', data: result, status: 201 });
});
