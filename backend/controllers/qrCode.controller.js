import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as qrCodeService from '../services/qrCode.service.js';

export const getForProduct = asyncHandler(async (req, res) => {
  const qr = await qrCodeService.getForProduct(Number(req.params.id), req.user.tenantId);
  return success(res, { data: qr });
});

export const regenerate = asyncHandler(async (req, res) => {
  const qr = await qrCodeService.generate(Number(req.params.id), req.user.tenantId);
  return success(res, { message: 'QR code regenerated', data: qr });
});
