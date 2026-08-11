import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as paymentService from '../services/payment.service.js';
import { getActiveProviderInfo } from '../services/paymentProviders/index.js';

// Lets BillingOverview.jsx show only the payment method(s) actually
// configured (Step 9) instead of hardcoding provider knowledge in the
// frontend — e.g. a phone-number field only appears when the active
// provider genuinely needs one.
export const getPaymentMethods = asyncHandler(async (req, res) => {
  return success(res, { data: getActiveProviderInfo() });
});

export const checkout = asyncHandler(async (req, res) => {
  const data = await paymentService.initiateCheckout(req.user.tenantId, req.body, req.user);
  return success(res, { message: 'Upgrade requested — awaiting payment confirmation', data, status: 201 });
});

export const listMine = asyncHandler(async (req, res) => {
  const { items, meta } = await paymentService.listMine(req.user.tenantId, req.query);
  return success(res, { data: { items, meta } });
});

export const listForPlatform = asyncHandler(async (req, res) => {
  const { items, meta } = await paymentService.listForPlatform(req.query);
  return success(res, { data: { items, meta } });
});

export const getForPlatform = asyncHandler(async (req, res) => {
  const payment = await paymentService.getForPlatform(Number(req.params.paymentId));
  return success(res, { data: payment });
});

export const confirmManually = asyncHandler(async (req, res) => {
  const data = await paymentService.confirmPaymentManually(Number(req.params.paymentId), req.platformAdmin, req.ip);
  return success(res, { message: 'Payment confirmed', data });
});

export const rejectManually = asyncHandler(async (req, res) => {
  const data = await paymentService.rejectPaymentManually(Number(req.params.paymentId), req.body.reason, req.platformAdmin, req.ip);
  return success(res, { message: 'Payment rejected', data });
});
