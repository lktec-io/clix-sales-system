import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { generateCode } from '../repositories/sequence.repository.js';
import { addBillingCycle, priceForCycle } from '../utils/billingCycle.js';
import * as paymentRepository from '../repositories/payment.repository.js';
import * as tenantSubscriptionRepository from '../repositories/tenantSubscription.repository.js';
import * as subscriptionPlanRepository from '../repositories/subscriptionPlan.repository.js';
import * as subscriptionEventRepository from '../repositories/subscriptionEvent.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';
import {
  createInvoiceForEvent, notifyTenant, markInvoicePaid,
} from './subscriptionLifecycle.service.js';
import { getProvider, getActiveProviderName } from './paymentProviders/index.js';

async function findActivePlan(planId) {
  const plan = await subscriptionPlanRepository.findById(planId);
  if (!plan || !plan.is_active) throw new ApiError(400, 'Selected plan is not available');
  return plan;
}

// Tenant self-service entry point (Step 6) — the previously-disabled
// "Upgrade Plan" button in BillingOverview.jsx now calls this. Reuses the
// exact subscription/invoice-creation logic subscriptionLifecycle.service
// .js's admin-initiated upgradePlan() already uses (convertFromTrial's SQL
// has no status guard, so it's equally correct for a trial tenant's first
// purchase and an already-paying tenant switching plans — see that
// repository function's own reasoning), but attributes the action to the
// tenant itself via the tenant-scoped activity log, never the
// platform-admin audit log, since no platform admin is involved.
//
// Always lands the subscription in 'pending_payment' — a tenant can never
// skip payment the way an admin's direct changePlan() override can. This
// is what actually creates the pending state a payment then confirms.
export async function initiateCheckout(tenantId, { planId, billingCycle, phoneNumber, mnoNetwork }, actingUser) {
  const plan = await findActivePlan(planId);
  const amount = priceForCycle(plan, billingCycle);
  const internalReference = await generateCode('PAYMENT', 'PAY', { tenantId, padLength: 8 });
  const providerName = getActiveProviderName();
  const provider = getProvider(providerName);

  // Deliberately called BEFORE any tenant_subscriptions/invoice/payment
  // row is written. The manual provider's createCheckout() can never
  // fail, so the original sequence (commit pending_payment, THEN call the
  // provider) was safe for it — but a real gateway's createCheckout() can
  // genuinely fail (bad phone number, gateway timeout, invalid
  // credentials), and if that happened AFTER committing pending_payment,
  // the tenant would hit the exact same "stuck in pending_payment forever"
  // bug rejectPaymentManually was fixed for, just via a different path. By
  // attempting the external call FIRST, a gateway failure here leaves
  // nothing to revert — the tenant's subscription is untouched and they
  // can simply retry.
  const checkout = await provider.createCheckout({
    amount, currency: plan.currency, reference: internalReference, tenantId, planId: plan.id, billingCycle, phoneNumber, mnoNetwork,
  });

  // The guard-then-write below runs inside one locked transaction — two
  // concurrent checkout requests for the same tenant (double-click, a
  // retried request on a flaky connection, two open tabs) would otherwise
  // both read status !== 'pending_payment' before either write lands,
  // each creating its own invoice/payment for the same upgrade. FOR
  // UPDATE (tenantSubscriptionRepository.findByTenantIdForUpdate) makes
  // the second request wait for the first transaction to commit, then see
  // the fresh 'pending_payment' status and correctly reject with 409 —
  // same pattern inventoryRepository.recordMovement() already uses for
  // its own read-check-write race.
  const connection = await pool.getConnection();
  let subscription;
  let updatedSubscription;
  const startDate = new Date();
  const endDate = addBillingCycle(startDate, billingCycle);
  try {
    await connection.beginTransaction();

    subscription = await tenantSubscriptionRepository.findByTenantIdForUpdate(tenantId, connection);
    if (!subscription) throw new ApiError(404, 'Tenant has no subscription record');
    if (subscription.status === 'pending_payment') {
      throw new ApiError(409, 'A payment is already in progress for this subscription. Wait for it to be confirmed or contact support.');
    }

    updatedSubscription = await tenantSubscriptionRepository.convertFromTrial(tenantId, {
      planId, billingCycle, startDate, endDate, renewalDate: endDate,
    }, connection);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const eventId = await subscriptionEventRepository.create({
    tenantId,
    subscriptionId: subscription.id,
    eventType: subscription.status === 'trial' ? 'trial_converted' : 'upgraded',
    fromPlanId: subscription.plan_id,
    toPlanId: planId,
    fromCycle: subscription.billing_cycle,
    toCycle: billingCycle,
    effectiveDate: startDate,
    reason: 'Tenant-initiated checkout',
    platformAdminId: null,
  });

  const invoice = await createInvoiceForEvent({
    tenantId, subscriptionId: subscription.id, eventId, plan, billingCycle, periodStart: startDate, periodEnd: endDate,
  });

  const payment = await paymentRepository.create({
    tenantId,
    subscriptionId: subscription.id,
    invoiceId: invoice.id,
    planId: plan.id,
    amount,
    currency: plan.currency,
    provider: providerName,
    internalReference,
    status: 'pending',
    paymentMethod: provider.SUPPORTED_METHODS?.[0] || null,
    metadata: checkout.providerReference ? { providerReference: checkout.providerReference } : null,
  });

  await activityLogRepository.create({
    tenantId,
    userId: actingUser.id,
    branchId: actingUser.branchId || null,
    description: `Requested upgrade to "${plan.name}" plan (${billingCycle}) — payment reference ${internalReference}`,
    referenceType: 'payment',
    referenceId: payment.id,
  });

  await notifyTenant(tenantId, {
    type: 'info', category: 'plan_changed', title: 'Upgrade requested',
    message: `Your request to move to the "${plan.name}" plan has been received and is awaiting payment confirmation.`,
    referenceId: subscription.id,
  });

  return { payment, invoice, subscription: updatedSubscription, checkout };
}

// Shared by the manual (platform-admin) and webhook (future real provider)
// confirmation paths below — the one place amount verification happens, so
// neither caller can independently forget it. tenantId/planId/invoiceId
// are always re-derived from the stored `payments` row, never taken from
// the caller, so a confirmation can never be misapplied to the wrong
// tenant, plan, or invoice (Step 15's "never trust
// req.body.tenantId/subscriptionId/amount").
async function applyConfirmedPayment(payment, { providerTransactionId, paymentMethod, metadata, reportedAmount }, admin, ipAddress) {
  if (payment.status === 'succeeded') {
    // Idempotent no-op — a duplicate/replayed webhook for an
    // already-confirmed payment must never re-activate or double-log.
    return { payment, invoice: null, subscription: null, alreadyProcessed: true };
  }
  if (!['pending', 'processing'].includes(payment.status)) {
    throw new ApiError(409, `Payment ${payment.internal_reference} is already ${payment.status} and cannot be confirmed.`);
  }

  if (reportedAmount !== undefined && Number(reportedAmount) !== Number(payment.amount)) {
    await paymentRepository.markFailed(payment.id, {
      failureReason: `Amount mismatch: expected ${payment.amount}, provider reported ${reportedAmount}`,
      providerTransactionId, metadata,
    });
    throw new ApiError(400, 'Payment amount does not match the invoice amount.');
  }

  const { affected, payment: updatedPayment } = await paymentRepository.markSucceeded(payment.id, { providerTransactionId, paymentMethod, metadata });
  if (!affected) {
    // Lost the race to a concurrent confirmation (webhook retry vs. a
    // platform admin's manual click, or two webhook deliveries) — the
    // other caller already flipped this row to 'succeeded' between our
    // status check above and this UPDATE. Same idempotent no-op as the
    // "already succeeded" branch at the top of this function, just
    // caught at write-time instead of read-time.
    return { payment: updatedPayment, invoice: null, subscription: null, alreadyProcessed: true };
  }

  let result = { invoice: null, subscription: null };
  if (payment.invoice_id) {
    result = await markInvoicePaid(payment.invoice_id, admin, ipAddress);
  }

  return { payment: updatedPayment, invoice: result.invoice, subscription: result.subscription, alreadyProcessed: false };
}

// Today's actual confirmation path — a platform admin has seen the money
// arrive (mobile money/bank transfer) and confirms it from the Platform
// Admin Payments view. Exactly the manual-provider reality documented in
// paymentProviders/manualPaymentProvider.js.
export async function confirmPaymentManually(paymentId, admin, ipAddress) {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');
  return applyConfirmedPayment(payment, { paymentMethod: 'manual' }, admin, ipAddress);
}

export async function rejectPaymentManually(paymentId, reason, admin, ipAddress) {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.status === 'succeeded') throw new ApiError(400, 'Payment is already confirmed and cannot be rejected.');

  const updated = await paymentRepository.markFailed(payment.id, { failureReason: reason || 'Rejected by platform admin' });

  // Without this, the subscription stays stuck in 'pending_payment'
  // forever — initiateCheckout refuses to start a new checkout while it's
  // pending, so a rejected tenant could never try again without a
  // platform admin manually intervening. Falls back to 'active' if this
  // was an existing paying customer switching plans (trial_converted_at
  // already set), 'trial' if it was their first-ever conversion attempt —
  // the exact same signal markInvoicePaid already uses the other way
  // around (wasTrialConversion = !subscription.trial_converted_at).
  const subscription = await tenantSubscriptionRepository.findById(payment.subscription_id);
  if (subscription && subscription.status === 'pending_payment') {
    const fallbackStatus = subscription.trial_converted_at ? 'active' : 'trial';
    await tenantSubscriptionRepository.revertPendingPayment(payment.tenant_id, fallbackStatus);
  }

  await platformAuditLogRepository.create({
    platformAdminId: admin?.id || null,
    action: 'payment.reject',
    description: `Rejected payment "${payment.internal_reference}"${reason ? ` — ${reason}` : ''}`,
    tenantId: payment.tenant_id,
    ipAddress,
  });
  await notifyTenant(payment.tenant_id, {
    type: 'danger', category: 'plan_changed', title: 'Payment could not be confirmed',
    message: `We could not confirm your payment (reference ${payment.internal_reference}). Please contact support.`,
    referenceId: payment.id,
  });
  return updated;
}

// The Phase-6 seam a real provider's webhook will call once one is
// configured (see paymentWebhook.controller.js) — idempotency is
// guaranteed by looking the payment up by the reference the server itself
// generated at checkout time, never by anything the webhook body claims.
export async function confirmPaymentFromWebhook({ internalReference, providerTransactionId, amount, paymentMethod, metadata }) {
  const payment = await paymentRepository.findByInternalReference(internalReference);
  if (!payment) throw new ApiError(404, `No payment found for reference ${internalReference}`);

  if (providerTransactionId) {
    const existing = await paymentRepository.findByProviderTransactionId(payment.provider, providerTransactionId);
    if (existing && existing.id !== payment.id) {
      throw new ApiError(409, 'This provider transaction has already been recorded against a different payment.');
    }
  }

  return applyConfirmedPayment(payment, { providerTransactionId, paymentMethod, metadata, reportedAmount: amount }, null, null);
}

export async function failPaymentFromWebhook({ internalReference, providerTransactionId, failureReason, metadata }) {
  const payment = await paymentRepository.findByInternalReference(internalReference);
  if (!payment) throw new ApiError(404, `No payment found for reference ${internalReference}`);
  if (payment.status === 'succeeded') return payment; // never let a late failure webhook undo a confirmed payment

  return paymentRepository.markFailed(payment.id, { failureReason, providerTransactionId, metadata });
}

export async function listMine(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await paymentRepository.findByTenant(tenantId, { page, limit, status: query.status });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listForPlatform(query) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await paymentRepository.findAllForPlatform({
    page, limit, tenantId: query.tenantId ? Number(query.tenantId) : undefined, status: query.status, provider: query.provider,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getForPlatform(id) {
  const payment = await paymentRepository.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  return payment;
}
