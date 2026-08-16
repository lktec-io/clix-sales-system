import * as tenantRepository from '../repositories/tenant.repository.js';
import * as tenantSubscriptionRepository from '../repositories/tenantSubscription.repository.js';
import * as subscriptionEventRepository from '../repositories/subscriptionEvent.repository.js';

const DEFAULT_PLAN_ID = 1; // Basic — see 024_create_billing_tables.sql's deterministic seed IDs (renamed from "Starter" by 045_update_final_commercial_pricing.sql).

// tenant.repository.js's findById() is called here, never modified — Phase 4
// never edits that file. Only ever hits the DB for a tenant that somehow
// slipped past 024's backfill; every existing tenant already has a row.
export async function getForTenant(tenantId) {
  let subscription = await tenantSubscriptionRepository.findByTenantId(tenantId);

  if (!subscription) {
    const tenant = await tenantRepository.findById(tenantId);
    subscription = await tenantSubscriptionRepository.getOrCreateForTenant(tenantId, {
      planId: DEFAULT_PLAN_ID,
      status: tenant?.subscription_status || 'trial',
      billingCycle: 'monthly',
      startDate: tenant?.trial_started_at || tenant?.created_at || new Date(),
      endDate: tenant?.trial_ends_at || null,
      renewalDate: tenant?.trial_ends_at || null,
    });
  }

  return reshape(subscription);
}

export async function listHistoryForTenant(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await subscriptionEventRepository.listForTenant(tenantId, { page, limit, eventType: query.eventType });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

function reshape(subscription) {
  const daysRemaining = subscription.end_date
    ? Math.max(0, Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / 86400000))
    : null;

  return {
    planId: subscription.plan_id,
    planName: subscription.plan_name,
    planSlug: subscription.plan_slug,
    status: subscription.status,
    billingCycle: subscription.billing_cycle,
    startDate: subscription.start_date,
    endDate: subscription.end_date,
    renewalDate: subscription.renewal_date,
    autoRenew: Boolean(subscription.auto_renew),
    trialConvertedAt: subscription.trial_converted_at,
    cancelledAt: subscription.cancelled_at,
    cancellationReason: subscription.cancellation_reason,
    gracePeriodEndsAt: subscription.grace_period_ends_at,
    scheduledPlanId: subscription.scheduled_plan_id,
    scheduledBillingCycle: subscription.scheduled_billing_cycle,
    scheduledEffectiveDate: subscription.scheduled_effective_date,
    daysRemaining,
  };
}
