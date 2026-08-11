// The only PaymentProvider implementation this environment has credentials
// for today: no gateway is configured, so "paying" means the tenant sends
// money by an existing offline channel (mobile money/bank transfer to the
// business's own account) and a platform admin confirms receipt — exactly
// the manual "Mark Paid" capability subscriptionLifecycle.service.js
// already had before this phase, now reachable from a tenant-initiated
// checkout instead of only an admin-initiated one.
//
// Every PaymentProvider implementation (this one and any real gateway
// added later) exposes the same two-method shape so payment.service.js
// never branches on which provider is active:
//   - createCheckout({ amount, currency, reference, tenant, plan, billingCycle })
//       -> { redirectUrl, providerReference, instructions }
//     redirectUrl/providerReference are null here — there is nothing to
//     redirect to. A real gateway returns a hosted checkout URL and its
//     own transaction reference instead.
//   - verifyWebhookSignature(rawBody, headers)
//       -> boolean
//     Always false here — this provider has no webhook; payments are
//     confirmed manually via the platform admin action instead
//     (payment.service.js#confirmPaymentManually). A real gateway
//     implements this with its own HMAC/signature scheme.

export const PROVIDER_NAME = 'manual';

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

export function verifyWebhookSignature() {
  return false;
}
