import { ApiError } from '../utils/apiError.js';
import { generateCode } from '../repositories/sequence.repository.js';
import { addBillingCycle, computeGracePeriodEnd, priceForCycle } from '../utils/billingCycle.js';
import * as tenantSubscriptionRepository from '../repositories/tenantSubscription.repository.js';
import * as subscriptionPlanRepository from '../repositories/subscriptionPlan.repository.js';
import * as subscriptionEventRepository from '../repositories/subscriptionEvent.repository.js';
import * as invoiceRepository from '../repositories/invoice.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';
import * as platformSettingsService from './platformSettings.service.js';

const INVOICE_PAYMENT_TERMS_DAYS = 7;

async function findOwnedSubscription(tenantId) {
  const subscription = await tenantSubscriptionRepository.findByTenantId(tenantId);
  if (!subscription) throw new ApiError(404, 'Tenant has no subscription record');
  return subscription;
}

async function findOwnedPlan(planId) {
  const plan = await subscriptionPlanRepository.findById(planId);
  if (!plan || !plan.is_active) throw new ApiError(400, 'Selected plan is not available');
  return plan;
}

async function logAction(platformAdminId, action, description, tenantId, ipAddress) {
  await platformAuditLogRepository.create({ platformAdminId, action, description, tenantId, ipAddress });
}

async function notifyTenant(tenantId, { type, category, title, message, referenceId }) {
  await notificationRepository.notifyBranchManagement(tenantId, null, {
    type, category, title, message, referenceType: 'tenant_subscription', referenceId,
  });
}

// Every mutation below deliberately never calls invalidateTenantCache() and
// never writes to `tenants` — tenant_subscriptions.status feeds nothing
// req.tenant reads, by design (see the Phase 4 plan's "Key design
// decisions"). requireActiveTrial.js keeps gating purely off
// tenants.trial_ends_at/subscription_status, completely unaffected by
// anything in this file.
async function createInvoiceForEvent({ tenantId, subscriptionId, eventId, plan, billingCycle, periodStart, periodEnd }) {
  const invoiceNumber = await generateCode('INVOICE', 'INV', { tenantId, padLength: 6 });
  const subtotal = priceForCycle(plan, billingCycle);
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + INVOICE_PAYMENT_TERMS_DAYS);

  return invoiceRepository.create({
    tenantId,
    subscriptionId,
    eventId,
    invoiceNumber,
    referenceNumber: invoiceNumber, // no external payment reference exists without a gateway (Phase 5) — placeholder is the invoice's own number
    planId: plan.id,
    planNameSnapshot: plan.name,
    billingCycle,
    periodStart,
    periodEnd,
    issueDate,
    dueDate,
    subtotal,
    taxAmount: 0,
    discountAmount: 0,
    total: subtotal,
    currency: plan.currency,
  });
}

// Covers both the tenant's very first move off Trial onto a paid plan
// (status lands on pending_payment, awaiting markInvoicePaid) and a lateral
// plan change for an already-paying tenant (status untouched). One function
// because from the tenant's and the admin's point of view both are "switch
// to plan X" — the branching only affects internal bookkeeping.
export async function upgradePlan(tenantId, { planId, billingCycle }, admin, ipAddress) {
  const subscription = await findOwnedSubscription(tenantId);
  const plan = await findOwnedPlan(planId);
  const fromPlanId = subscription.plan_id;
  const fromCycle = subscription.billing_cycle;

  let updated;
  if (subscription.status === 'trial') {
    const startDate = new Date();
    const endDate = addBillingCycle(startDate, billingCycle);
    updated = await tenantSubscriptionRepository.convertFromTrial(tenantId, {
      planId, billingCycle, startDate, endDate, renewalDate: endDate,
    });
  } else {
    updated = await tenantSubscriptionRepository.changePlan(tenantId, { planId, billingCycle });
  }

  const eventId = await subscriptionEventRepository.create({
    tenantId, subscriptionId: subscription.id, eventType: subscription.status === 'trial' ? 'trial_converted' : 'upgraded',
    fromPlanId, toPlanId: planId, fromCycle, toCycle: billingCycle, effectiveDate: new Date(),
    reason: null, platformAdminId: admin.id,
  });

  const invoice = await createInvoiceForEvent({
    tenantId, subscriptionId: subscription.id, eventId, plan, billingCycle,
    periodStart: updated.start_date || new Date(), periodEnd: updated.end_date || addBillingCycle(new Date(), billingCycle),
  });

  await logAction(admin.id, 'subscription.upgrade', `Moved "${subscription.tenant_id}" to plan "${plan.name}" (${billingCycle})`, tenantId, ipAddress);
  await notifyTenant(tenantId, {
    type: 'info', category: 'plan_changed', title: 'Plan changed',
    message: `Your subscription is now on the "${plan.name}" plan.`, referenceId: subscription.id,
  });

  return { subscription: updated, invoice };
}

// Same repository call as upgradePlan (changePlan doesn't care about
// direction) — separated only so the event log records 'downgraded', which
// is what Step 3's "Downgrade History" filters on.
export async function downgradePlan(tenantId, { planId, billingCycle }, admin, ipAddress) {
  const subscription = await findOwnedSubscription(tenantId);
  const plan = await findOwnedPlan(planId);
  const fromPlanId = subscription.plan_id;
  const fromCycle = subscription.billing_cycle;

  const updated = await tenantSubscriptionRepository.changePlan(tenantId, { planId, billingCycle });

  const eventId = await subscriptionEventRepository.create({
    tenantId, subscriptionId: subscription.id, eventType: 'downgraded',
    fromPlanId, toPlanId: planId, fromCycle, toCycle: billingCycle, effectiveDate: new Date(),
    reason: null, platformAdminId: admin.id,
  });

  const invoice = await createInvoiceForEvent({
    tenantId, subscriptionId: subscription.id, eventId, plan, billingCycle,
    periodStart: new Date(), periodEnd: updated.end_date || addBillingCycle(new Date(), billingCycle),
  });

  await logAction(admin.id, 'subscription.downgrade', `Moved tenant #${tenantId} to plan "${plan.name}" (${billingCycle})`, tenantId, ipAddress);
  await notifyTenant(tenantId, {
    type: 'info', category: 'plan_changed', title: 'Plan changed',
    message: `Your subscription is now on the "${plan.name}" plan.`, referenceId: subscription.id,
  });

  return { subscription: updated, invoice };
}

export async function renewSubscription(tenantId, admin, ipAddress) {
  const subscription = await findOwnedSubscription(tenantId);
  const plan = await findOwnedPlan(subscription.plan_id);

  const anchor = subscription.end_date && new Date(subscription.end_date) > new Date() ? subscription.end_date : new Date();
  const newEndDate = addBillingCycle(anchor, subscription.billing_cycle);

  const updated = await tenantSubscriptionRepository.renew(tenantId, { endDate: newEndDate, renewalDate: newEndDate });

  const eventId = await subscriptionEventRepository.create({
    tenantId, subscriptionId: subscription.id, eventType: 'renewed',
    fromPlanId: subscription.plan_id, toPlanId: subscription.plan_id,
    fromCycle: subscription.billing_cycle, toCycle: subscription.billing_cycle,
    effectiveDate: new Date(), reason: null, platformAdminId: admin.id,
  });

  const invoice = await createInvoiceForEvent({
    tenantId, subscriptionId: subscription.id, eventId, plan, billingCycle: subscription.billing_cycle,
    periodStart: anchor, periodEnd: newEndDate,
  });

  await logAction(admin.id, 'subscription.renew', `Renewed subscription for tenant #${tenantId} until ${newEndDate.toISOString()}`, tenantId, ipAddress);

  return { subscription: updated, invoice };
}

export async function cancelSubscription(tenantId, reason, admin, ipAddress) {
  const subscription = await findOwnedSubscription(tenantId);
  const updated = await tenantSubscriptionRepository.cancel(tenantId, { reason });

  await subscriptionEventRepository.create({
    tenantId, subscriptionId: subscription.id, eventType: 'cancelled',
    fromPlanId: subscription.plan_id, toPlanId: subscription.plan_id,
    effectiveDate: new Date(), reason, platformAdminId: admin.id,
  });

  await logAction(admin.id, 'subscription.cancel', `Cancelled subscription for tenant #${tenantId}${reason ? ` — ${reason}` : ''}`, tenantId, ipAddress);
  await notifyTenant(tenantId, {
    type: 'warning', category: 'plan_changed', title: 'Subscription cancelled',
    message: 'Your subscription has been cancelled.', referenceId: subscription.id,
  });

  return updated;
}

export async function resumeSubscription(tenantId, admin, ipAddress) {
  const subscription = await findOwnedSubscription(tenantId);
  const updated = await tenantSubscriptionRepository.resume(tenantId);

  await subscriptionEventRepository.create({
    tenantId, subscriptionId: subscription.id, eventType: 'resumed',
    fromPlanId: subscription.plan_id, toPlanId: subscription.plan_id,
    effectiveDate: new Date(), reason: null, platformAdminId: admin.id,
  });

  await logAction(admin.id, 'subscription.resume', `Resumed subscription for tenant #${tenantId}`, tenantId, ipAddress);
  await notifyTenant(tenantId, {
    type: 'success', category: 'plan_changed', title: 'Subscription resumed',
    message: 'Your subscription has been resumed.', referenceId: subscription.id,
  });

  return updated;
}

export async function scheduleplanChange(tenantId, { planId, billingCycle, effectiveDate }, admin, ipAddress) {
  const subscription = await findOwnedSubscription(tenantId);
  const plan = await findOwnedPlan(planId);

  const updated = await tenantSubscriptionRepository.scheduleChange(tenantId, { planId, billingCycle, effectiveDate });

  await subscriptionEventRepository.create({
    tenantId, subscriptionId: subscription.id, eventType: 'scheduled',
    fromPlanId: subscription.plan_id, toPlanId: planId, fromCycle: subscription.billing_cycle, toCycle: billingCycle,
    effectiveDate, reason: null, platformAdminId: admin.id,
  });

  await logAction(admin.id, 'subscription.schedule_change', `Scheduled tenant #${tenantId} to move to "${plan.name}" on ${new Date(effectiveDate).toDateString()}`, tenantId, ipAddress);

  return updated;
}

// The Phase-5 seam: a real payment-gateway webhook will call this exact
// function once it confirms a charge, instead of a platform admin clicking
// "Mark Paid" for manual bookkeeping today. Nothing about this function's
// signature or behavior should need to change for that to happen.
export async function markInvoicePaid(invoiceId, admin, ipAddress) {
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  if (invoice.payment_status === 'paid') throw new ApiError(400, 'Invoice is already marked paid');

  const updatedInvoice = await invoiceRepository.markPaid(invoiceId);
  const subscription = await tenantSubscriptionRepository.findById(invoice.subscription_id);

  let updatedSubscription = subscription;
  if (subscription && subscription.status === 'pending_payment') {
    const wasTrialConversion = !subscription.trial_converted_at;
    updatedSubscription = await tenantSubscriptionRepository.activate(invoice.tenant_id, { trialConverted: wasTrialConversion });
  }

  await logAction(admin.id, 'invoice.mark_paid', `Marked invoice "${invoice.invoice_number}" as paid`, invoice.tenant_id, ipAddress);
  await notifyTenant(invoice.tenant_id, {
    type: 'success', category: 'invoice_generated', title: 'Payment confirmed',
    message: `Invoice "${invoice.invoice_number}" has been marked as paid.`, referenceId: invoice.id,
  });

  return { invoice: updatedInvoice, subscription: updatedSubscription };
}

// Ad-hoc/manual re-issue — e.g. an admin wants a fresh invoice for the
// tenant's current plan without changing anything about the subscription
// itself (no event_type mutation, no plan/date change).
export async function generateInvoice(tenantId, admin, ipAddress) {
  const subscription = await findOwnedSubscription(tenantId);
  const plan = await findOwnedPlan(subscription.plan_id);

  const invoice = await createInvoiceForEvent({
    tenantId, subscriptionId: subscription.id, eventId: null, plan, billingCycle: subscription.billing_cycle,
    periodStart: subscription.start_date || new Date(), periodEnd: subscription.end_date || addBillingCycle(new Date(), subscription.billing_cycle),
  });

  await logAction(admin.id, 'invoice.generate', `Generated an ad-hoc invoice for tenant #${tenantId}`, tenantId, ipAddress);

  return invoice;
}

// --- Cron entry points (subscriptionLifecycleJob.js) — system-triggered,
// no admin actor (platformAdminId stays NULL in the event log, exactly as
// migration 024's own comment anticipated). Never touches `tenants`. ---

export async function applyDueScheduledChanges() {
  const due = await tenantSubscriptionRepository.findDueForScheduledChange();
  for (const subscription of due) {
    await tenantSubscriptionRepository.applyScheduledChange(subscription.id, {
      planId: subscription.scheduled_plan_id, billingCycle: subscription.scheduled_billing_cycle,
    });
    await subscriptionEventRepository.create({
      tenantId: subscription.tenant_id, subscriptionId: subscription.id, eventType: 'schedule_applied',
      fromPlanId: subscription.plan_id, toPlanId: subscription.scheduled_plan_id,
      fromCycle: subscription.billing_cycle, toCycle: subscription.scheduled_billing_cycle,
      effectiveDate: new Date(), reason: 'Scheduled change applied automatically',
    });
    await notifyTenant(subscription.tenant_id, {
      type: 'info', category: 'plan_changed', title: 'Plan changed', message: 'Your scheduled plan change has taken effect.', referenceId: subscription.id,
    });
  }
  return due.length;
}

export async function sweepLifecycleTransitions() {
  const graceDays = await platformSettingsService.getGracePeriodDefaultDays();

  const pastEnd = await tenantSubscriptionRepository.findPastEndDate();
  for (const subscription of pastEnd) {
    const gracePeriodEndsAt = computeGracePeriodEnd(subscription.end_date, graceDays);
    await tenantSubscriptionRepository.transitionToGracePeriod(subscription.id, gracePeriodEndsAt);
  }

  const pastGrace = await tenantSubscriptionRepository.findPastGracePeriod();
  for (const subscription of pastGrace) {
    await tenantSubscriptionRepository.transitionToExpired(subscription.id);
  }

  const expiringSoon = await tenantSubscriptionRepository.findExpiringSoonUnnotified(3);
  for (const subscription of expiringSoon) {
    const category = subscription.status === 'trial' ? 'trial_ending' : 'subscription_expiring';
    await notifyTenant(subscription.tenant_id, {
      type: 'warning', category, title: subscription.status === 'trial' ? 'Trial ending soon' : 'Subscription expiring soon',
      message: `"${subscription.company_name}"'s ${subscription.status === 'trial' ? 'trial' : 'subscription'} ends soon — renew to avoid interruption.`,
      referenceId: subscription.id,
    });
  }

  const justExpired = await tenantSubscriptionRepository.findJustExpiredUnnotified();
  for (const subscription of justExpired) {
    await notifyTenant(subscription.tenant_id, {
      type: 'danger', category: 'subscription_expired', title: 'Subscription expired',
      message: `"${subscription.company_name}"'s subscription has expired.`, referenceId: subscription.id,
    });
  }

  return { movedToGracePeriod: pastEnd.length, movedToExpired: pastGrace.length, notified: expiringSoon.length + justExpired.length };
}
