import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as saleService from '../services/sale.service.js';
import * as receiptService from '../services/receipt.service.js';
import * as companyService from '../services/company.service.js';
import * as systemSettingsService from '../services/systemSettings.service.js';
import { resolveLocale } from '../i18n/index.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await saleService.listSales(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const sale = await saleService.getSale(Number(req.params.id), req.user.tenantId, req.user);
  return success(res, { data: sale });
});

export const checkout = asyncHandler(async (req, res) => {
  const sale = await saleService.checkout(req.body, req.user.id, req.user);
  return success(res, { message: 'Sale completed and inventory updated', data: sale, status: 201 });
});

export const receipt = asyncHandler(async (req, res) => {
  const sale = await saleService.getSale(Number(req.params.id), req.user.tenantId);
  const [company, { receiptQrVerificationEnabled }] = await Promise.all([
    companyService.getProfile(req.user.tenantId),
    systemSettingsService.getSettings(req.user.tenantId),
  ]);
  const pdf = await receiptService.buildReceiptPdf(sale, company, req.query.size, receiptQrVerificationEnabled, resolveLocale(req.query.locale));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${sale.sale_number}.pdf"`);
  res.send(pdf);
});
