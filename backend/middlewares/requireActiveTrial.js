import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as tenantSubscriptionRepository from '../repositories/tenantSubscription.repository.js';

// Blocks writes for a tenant whose trial/subscription has lapsed — never
// gates login/dashboard/reports/profile/settings, which read-only routes
// never apply this middleware to in the first place.
//
// Phase 6 fix: tenant_subscriptions (the richer billing-engine table —
// see subscriptionLifecycle.service.js) is the live, actively-maintained
// source of truth once a tenant has a row there (every tenant does, since
// 024_create_billing_tables.sql's backfill + getOrCreateForTenant). Before
// this fix, this middleware only ever looked at the legacy
// tenants.subscription_status/trial_ends_at columns, which nothing in the
// billing engine ever updates — meaning a tenant who successfully
// converted from trial to a paid plan (tenant_subscriptions.status
// ='active') would still get blocked here forever once their ORIGINAL
// trial_ends_at date passed, because paying never touched `tenants` at
// all. That made "pay to keep using the app" impossible; this is the fix.
//
// 'trial', 'active', 'grace_period', and 'pending_payment' are all
// allowed — a payment attempt in flight (pending_payment) must not cut a
// tenant off mid-checkout, and grace_period is deliberately still-access
// by design (see tenantSubscription.repository.js's own
// getMonthlyRevenueProjected(), which already treats active+grace_period
// as equivalent "still a customer" states). Only 'expired', 'cancelled',
// and 'suspended' block — exactly Step 10's "Trial expired / subscription
// expired -> controlled restricted state."
//
// Falls back to the original tenants-table check only if no
// tenant_subscriptions row exists yet (should not happen in practice, but
// fails toward the pre-Phase-6 behavior rather than toward open access).
//
// 402 Payment Required is otherwise unused anywhere in this backend — a
// clean, unambiguous signal the frontend can special-case without
// colliding with any existing 4xx meaning.
const BLOCKED_SUBSCRIPTION_STATUSES = ['expired', 'cancelled', 'suspended'];

export const requireActiveTrial = asyncHandler(async (req, res, next) => {
  const tenant = req.tenant; // populated by authenticate.js

  const subscription = await tenantSubscriptionRepository.findByTenantId(tenant.id);

  if (subscription) {
    if (BLOCKED_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
      const message = subscription.status === 'suspended'
        ? 'Your subscription has been suspended. Contact support to restore access.'
        : 'Your trial or subscription has expired. Upgrade your subscription to continue.';
      throw new ApiError(402, message);
    }
    return next();
  }

  const trialExpired = tenant.subscription_status === 'trial'
    && tenant.trial_ends_at
    && new Date(tenant.trial_ends_at) <= new Date();

  if (trialExpired || tenant.subscription_status === 'expired') {
    throw new ApiError(402, 'Your trial has expired. Upgrade your subscription to continue.');
  }

  return next();
});
