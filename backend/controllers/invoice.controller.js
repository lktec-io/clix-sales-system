import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as invoiceService from '../services/invoice.service.js';
import * as subscriptionLifecycleService from '../services/subscriptionLifecycle.service.js';

export const listMine = asyncHandler(async (req, res) => {
  const { items, meta } = await invoiceService.listMine(req.user.tenantId, req.query);
  return success(res, { data: { items, meta } });
});

export const getMine = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getMine(Number(req.params.id), req.user.tenantId);
  return success(res, { data: invoice });
});

export const downloadMinePdf = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getMine(Number(req.params.id), req.user.tenantId);
  const pdf = await invoiceService.downloadPdf(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
  res.send(pdf);
});

export const listForPlatform = asyncHandler(async (req, res) => {
  const { items, meta } = await invoiceService.listForPlatform(req.query);
  return success(res, { data: { items, meta } });
});

export const getForPlatform = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getForPlatform(Number(req.params.invoiceId));
  return success(res, { data: invoice });
});

export const downloadPlatformPdf = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getForPlatform(Number(req.params.invoiceId));
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  const pdf = await invoiceService.downloadPdf(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
  res.send(pdf);
});

export const markPaid = asyncHandler(async (req, res) => {
  const data = await subscriptionLifecycleService.markInvoicePaid(Number(req.params.invoiceId), req.platformAdmin, req.ip);
  return success(res, { message: 'Invoice marked as paid', data });
});
