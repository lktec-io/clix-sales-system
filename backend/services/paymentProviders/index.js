import { env } from '../../config/env.js';
import * as manualPaymentProvider from './manualPaymentProvider.js';
import * as azampayPaymentProvider from './azampayPaymentProvider.js';

// Provider registry — Step 4's "add another Tanzanian payment provider
// later without rewriting billing." Adding a real gateway means: write a
// new module implementing the same
// { PROVIDER_NAME, SUPPORTED_METHODS, createCheckout, parseWebhookPayload, verifyWebhookSignature }
// shape as manualPaymentProvider.js/azampayPaymentProvider.js, register it
// here under its own name, and flip PAYMENT_PROVIDER in the environment.
// Nothing in payment.service.js, the webhook route, or the checkout
// controller needs to change.
const PROVIDERS = {
  [manualPaymentProvider.PROVIDER_NAME]: manualPaymentProvider,
  [azampayPaymentProvider.PROVIDER_NAME]: azampayPaymentProvider,
};

// Reads from the centralized env config (config/env.js), which itself
// falls back to 'manual' when PAYMENT_PROVIDER is unset — so an
// environment with no AzamPay credentials configured keeps working on the
// manual/offline payment path with zero code change.
export function getActiveProviderName() {
  const configured = env.payment.provider;
  return PROVIDERS[configured] ? configured : manualPaymentProvider.PROVIDER_NAME;
}

export function getProvider(name = getActiveProviderName()) {
  return PROVIDERS[name] || null;
}

// Backs GET /billing/payment-methods — lets the checkout UI show only the
// payment method(s) the currently active provider genuinely supports
// (Step 9), instead of the frontend hardcoding provider knowledge.
export function getActiveProviderInfo() {
  const name = getActiveProviderName();
  const provider = PROVIDERS[name];
  return {
    provider: name,
    supportedMethods: provider.SUPPORTED_METHODS,
    mnoNetworks: provider.SUPPORTED_MNO_NETWORKS || null,
  };
}
