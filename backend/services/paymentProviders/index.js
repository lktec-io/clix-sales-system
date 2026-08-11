import * as manualPaymentProvider from './manualPaymentProvider.js';

// Provider registry — Step 4's "add another Tanzanian payment provider
// later without rewriting billing." Adding a real gateway means: write a
// new module implementing the same { createCheckout, verifyWebhookSignature }
// shape as manualPaymentProvider.js, register it here under its own name,
// and optionally flip PAYMENT_PROVIDER in the environment. Nothing in
// payment.service.js, the webhook route, or the checkout controller needs
// to change.
const PROVIDERS = {
  [manualPaymentProvider.PROVIDER_NAME]: manualPaymentProvider,
};

// No live gateway is configured in this environment, so this always
// resolves to 'manual' today. Reading it from the environment (rather than
// hardcoding 'manual' as a constant) is what makes switching to a real
// provider later a config change, not a code change.
export function getActiveProviderName() {
  const configured = process.env.PAYMENT_PROVIDER || manualPaymentProvider.PROVIDER_NAME;
  return PROVIDERS[configured] ? configured : manualPaymentProvider.PROVIDER_NAME;
}

export function getProvider(name = getActiveProviderName()) {
  return PROVIDERS[name] || null;
}
