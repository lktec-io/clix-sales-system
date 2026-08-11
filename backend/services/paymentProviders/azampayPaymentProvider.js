import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../utils/apiError.js';

// ============================================================================
// AzamPay adapter — Phase 6B.
//
// HONESTY NOTE (read before relying on this in production): this was built
// against AzamPay's publicly known API shape from general knowledge, NOT
// against AzamPay's current official documentation or a live sandbox
// account — none was available when this was written (no credentials, no
// docs supplied). The pieces below are flagged individually by confidence:
//
//   - Auth (token exchange) and MNO checkout endpoint shapes: MODERATE
//     confidence — this is AzamPay's well-known "generate token, then call
//     mno/checkout" pattern, but exact field names/casing should be
//     confirmed against your AzamPay merchant sandbox before go-live.
//   - Callback (webhook) field names (`transactionstatus`, `utilityref`,
//     `msisdn`, `reference`, `operator`, `amount`): MODERATE confidence,
//     NOT verified against a live callback payload.
//   - Callback AUTHENTICATION mechanism: LOW confidence. AzamPay's exact
//     webhook-authenticity model (a signed header, a pre-shared secret
//     field, IP allowlisting, or some combination) is not something I
//     could confirm without live documentation. What's implemented below
//     is a shared-secret header check that FAILS CLOSED (rejects every
//     callback) whenever AZAMPAY_CALLBACK_SECRET is unset — the same
//     fail-closed default manualPaymentProvider.js already uses. Do not
//     set AZAMPAY_CALLBACK_SECRET, and do not route real traffic to this
//     provider, until you've confirmed the actual mechanism against
//     AzamPay's merchant onboarding documentation and updated
//     verifyWebhookSignature() below to match it exactly.
//
// Every value AzamPay reports (status, amount, transaction id) is still
// only ever used to confirm or fail a payment.service.js-owned `payments`
// row looked up by our own internal_reference — never to create one, never
// to set a tenant/plan/amount that didn't already exist server-side. That
// trust boundary does not depend on any of the above being exactly right;
// getting a field name wrong fails a checkout or a webhook parse, it can
// never mis-attribute money to the wrong tenant or invent a payment.
// ============================================================================

export const PROVIDER_NAME = 'azampay';
// AzamPay aggregates these Tanzanian mobile money networks. Exact
// provider-code casing/spelling AzamPay's API expects is unconfirmed —
// see the honesty note above.
export const SUPPORTED_METHODS = ['mobile_money'];
export const SUPPORTED_MNO_NETWORKS = ['Mpesa', 'TigoPesa', 'AirtelMoney', 'HaloPesa', 'AzamPesa'];

const STATUS_MAP = {
  success: 'succeeded',
  successful: 'succeeded',
  completed: 'succeeded',
  failed: 'failed',
  failure: 'failed',
  cancelled: 'failed',
  canceled: 'failed',
  timeout: 'failed',
};

function mapGatewayStatus(rawStatus) {
  const normalized = String(rawStatus || '').trim().toLowerCase();
  // An unrecognized status is treated as failed, never as succeeded — a
  // webhook whose status we don't understand must never accidentally
  // activate a subscription (Step 14's "unknown gateway status").
  return STATUS_MAP[normalized] || 'failed';
}

// In-process token cache — same Map+TTL shape as tenantContext.js's
// resolveTenant() cache, sized for exactly one entry (AzamPay issues one
// app-level token, not a per-tenant one). Re-fetched a minute before actual
// expiry so a request never races an about-to-expire token.
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && cachedTokenExpiresAt > Date.now()) {
    return cachedToken;
  }

  if (!env.payment.azampay.clientId || !env.payment.azampay.clientSecret || !env.payment.azampay.appName) {
    throw new ApiError(503, 'Payment gateway is not configured. Contact support.');
  }

  let response;
  try {
    response = await fetch(`${env.payment.azampay.authUrl}/AppRegistration/GenerateToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName: env.payment.azampay.appName,
        clientId: env.payment.azampay.clientId,
        clientSecret: env.payment.azampay.clientSecret,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    logger.error('AzamPay token request failed (network/timeout)', { message: err.message });
    throw new ApiError(503, 'Payment gateway is currently unavailable. Please try again shortly.');
  }

  if (!response.ok) {
    // Never log the request body (contains clientSecret) — only the
    // response status, which carries no credential.
    logger.error('AzamPay token request rejected', { status: response.status });
    throw new ApiError(503, 'Payment gateway rejected the connection. Contact support.');
  }

  const payload = await response.json().catch(() => null);
  const accessToken = payload?.data?.accessToken;
  if (!accessToken) {
    logger.error('AzamPay token response missing accessToken', { hasPayload: Boolean(payload) });
    throw new ApiError(503, 'Payment gateway returned an unexpected response. Contact support.');
  }

  cachedToken = accessToken;
  // AzamPay reports its own expiry (`data.expire`); fall back to a
  // conservative 50-minute assumption if that field isn't present in the
  // exact shape expected, refreshing a minute early either way.
  const expiresAt = payload?.data?.expire ? new Date(payload.data.expire).getTime() : Date.now() + 50 * 60_000;
  cachedTokenExpiresAt = expiresAt - 60_000;

  return accessToken;
}

// AzamPay's MNO checkout is a PUSH flow, not a hosted redirect page — the
// customer gets a USSD/app prompt on their own phone to approve with their
// PIN. That's why `phoneNumber`/`mnoNetwork` exist here (and nowhere in
// manualPaymentProvider.js): this is the one provider that genuinely needs
// them, threaded through from payment.service.js#initiateCheckout only
// when this provider is active.
export async function createCheckout({ amount, currency, reference, phoneNumber, mnoNetwork }) {
  if (!phoneNumber) {
    throw new ApiError(400, 'A mobile money phone number is required for this payment method.');
  }
  if (!SUPPORTED_MNO_NETWORKS.includes(mnoNetwork)) {
    throw new ApiError(400, 'Select a valid mobile money network.');
  }

  const accessToken = await getAccessToken();

  let response;
  try {
    response = await fetch(`${env.payment.azampay.checkoutUrl}/azampay/mno/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        accountNumber: phoneNumber,
        amount: String(amount),
        currency,
        externalId: reference,
        provider: mnoNetwork,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    logger.error('AzamPay checkout request failed (network/timeout)', { reference, message: err.message });
    throw new ApiError(503, 'Could not reach the payment gateway. Please try again shortly.');
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    logger.error('AzamPay checkout request rejected', { reference, status: response.status, message: payload?.message });
    throw new ApiError(502, payload?.message || 'The payment gateway declined this request.');
  }

  logger.info('AzamPay checkout initiated', { reference, mnoNetwork });

  return {
    redirectUrl: null,
    providerReference: payload?.transactionId || null,
    instructions: {
      type: 'push',
      reference,
      amount,
      currency,
      phoneNumber,
      mnoNetwork,
    },
  };
}

// Translates AzamPay's callback body into the generic envelope
// paymentWebhook.controller.js already speaks. Field names below
// (utilityref/transactionstatus/msisdn/reference) are AzamPay's commonly
// documented callback fields — see this file's header for the confidence
// caveat.
export function parseWebhookPayload(body) {
  return {
    internalReference: body?.utilityref,
    providerTransactionId: body?.reference,
    status: mapGatewayStatus(body?.transactionstatus),
    amount: body?.amount,
    paymentMethod: 'mobile_money',
    metadata: {
      msisdn: body?.msisdn,
      operator: body?.operator,
      message: body?.message,
    },
  };
}

// Fails closed whenever AZAMPAY_CALLBACK_SECRET isn't set — see this
// file's header comment for why the exact transport (header vs body field
// vs IP allowlist) is unconfirmed. Uses a constant-time comparison so a
// timing side-channel can't leak the configured secret one byte at a time,
// same defensive habit as any other secret comparison in this codebase.
export function verifyWebhookSignature(rawBody, headers) {
  const configuredSecret = env.payment.azampay.callbackSecret;
  if (!configuredSecret) return false;

  const provided = headers?.['x-azampay-callback-secret'];
  if (!provided) return false;

  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(configuredSecret);
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
