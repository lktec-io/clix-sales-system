// The only PaymentProvider implementation this environment has credentials
// for today: no gateway is configured, so "paying" means the tenant sends
// money by an existing offline channel (mobile money/bank transfer to the
// business's own account) and a platform admin confirms receipt — exactly
// the manual "Mark Paid" capability subscriptionLifecycle.service.js
// already had before this phase, now reachable from a tenant-initiated
// checkout instead of only an admin-initiated one.
//
// Every PaymentProvider implementation (this one, azampayPaymentProvider.js,
// and any future gateway) exposes the same shape so payment.service.js and
// paymentWebhook.controller.js never branch on which provider is active —
// each provider translates its own API into this common shape internally:
//   - PROVIDER_NAME / SUPPORTED_METHODS
//       Identifies the provider and which payment methods it genuinely
//       offers (Step 9 — "only show methods actually supported"). Read by
//       GET /billing/payment-methods so the checkout UI can adapt without
//       hardcoding provider knowledge in the frontend.
//   - createCheckout({ amount, currency, reference, phoneNumber, ... })
//       -> { redirectUrl, providerReference, instructions }
//     redirectUrl/providerReference are null here — there is nothing to
//     redirect to or track upstream. A real gateway returns a hosted
//     checkout URL and/or its own transaction reference instead.
//   - parseWebhookPayload(body)
//       -> { internalReference, providerTransactionId, status, amount, paymentMethod, metadata }
//     Passthrough here — this provider has no real webhook body to
//     translate (verifyWebhookSignature always rejects first anyway).
//     A real gateway's implementation is where its own field names
//     (whatever they are) get mapped into this generic shape — see Step 7.
//   - verifyWebhookSignature(rawBody, headers)
//       -> boolean
//     Always false here — this provider has no webhook; payments are
//     confirmed manually via the platform admin action instead
//     (payment.service.js#confirmPaymentManually). A real gateway
//     implements this with its own signature/shared-secret scheme.

export const PROVIDER_NAME = 'manual';
export const SUPPORTED_METHODS = ['manual'];

export async function createCheckout({ amount, currency, reference }) {
  return {
    redirectUrl: null,
    providerReference: null,
    instructions: {
      type: 'manual',
      reference,
      amount,
      currency,
    },
  };
}

export function parseWebhookPayload(body) {
  return body;
}

export function verifyWebhookSignature() {
  return false;
}
