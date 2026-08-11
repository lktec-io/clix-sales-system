import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { logger } from '../config/logger.js';
import * as paymentService from '../services/payment.service.js';
import { getProvider } from '../services/paymentProviders/index.js';

// Each provider adapter's own parseWebhookPayload() translates its
// provider-specific body into this one generic envelope (Step 7 — "keep
// provider-specific terminology inside the provider adapter") before
// anything below ever touches it. Never reads tenantId/planId/
// subscriptionId from the body — those are only ever re-derived
// server-side from the stored `payments` row via internalReference,
// exactly per Step 15.
export const handleWebhook = asyncHandler(async (req, res) => {
  const provider = getProvider(req.params.provider);
  const { internalReference, providerTransactionId, status, amount, paymentMethod, metadata } = provider.parseWebhookPayload(req.body);

  if (!internalReference || !status) {
    return success(res, { message: 'Ignored: missing internalReference or status', status: 200 });
  }

  // Business-logic rejections (already processed, amount mismatch, unknown
  // reference) are caught and logged here rather than left to propagate as
  // an HTTP error — a signature-verified webhook that describes a state
  // the server can't apply is not a delivery failure a provider should
  // retry, it's a fact to record. A genuine delivery/parsing problem still
  // never reaches this far (missing internalReference/status short-circuits
  // above; signature failure short-circuits in verifyWebhookSignature.js).
  try {
    if (status === 'succeeded') {
      await paymentService.confirmPaymentFromWebhook({ internalReference, providerTransactionId, amount, paymentMethod, metadata });
    } else if (status === 'failed') {
      await paymentService.failPaymentFromWebhook({
        internalReference, providerTransactionId, failureReason: metadata?.failureReason || metadata?.message, metadata,
      });
    }
  } catch (err) {
    logger.error('Payment webhook could not be applied', { internalReference, status, message: err.message });
  }

  return success(res, { message: 'Webhook processed' });
});
