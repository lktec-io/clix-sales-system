import { ApiError } from '../utils/apiError.js';
import { getProvider } from '../services/paymentProviders/index.js';

// Every payment-provider webhook must pass through here before its
// controller ever runs — Step 5's "protect against... fake frontend
// success responses" applies just as much to an unsigned/forged webhook
// call as to a client claiming success directly. req.rawBody is captured
// by app.js's express.json({ verify }) hook specifically so a real
// provider's HMAC-over-raw-body signature scheme can be checked here
// without altering how every other route's body is parsed.
//
// The active provider (manualPaymentProvider.js today) always returns
// false — there is no real webhook to receive yet, so this correctly
// rejects every call until a real provider with its own
// verifyWebhookSignature() implementation is registered in
// paymentProviders/index.js. It fails closed, never open: no provider,
// no verification, no access.
export function verifyWebhookSignature(req, res, next) {
  const providerName = req.params.provider;
  const provider = getProvider(providerName);

  if (!provider) {
    throw new ApiError(404, `Unknown payment provider: ${providerName}`);
  }

  const verified = provider.verifyWebhookSignature(req.rawBody, req.headers);
  if (!verified) {
    throw new ApiError(401, 'Webhook signature verification failed');
  }

  return next();
}
