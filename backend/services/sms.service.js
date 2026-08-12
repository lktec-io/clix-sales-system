import { env } from '../config/env.js';
import * as smsLogRepository from '../repositories/smsLog.repository.js';
import { getActiveProvider, getActiveProviderName } from './smsProviders/index.js';

// Repair-notification message templates. Kept short and deliberately
// generic (no invented business copy/branding) — a tenant customizing
// message wording is future scope, not something to fabricate here.
const MESSAGE_TEMPLATES = {
  repair_received: (repair) => `Your ${repair.brand} ${repair.model} (Repair #${repair.repair_number}) has been received and is being processed.`,
  repair_diagnosis_update: (repair) => `Update on Repair #${repair.repair_number}: diagnosis has been completed. Contact us for details.`,
  repair_ready_for_collection: (repair) => `Good news! Repair #${repair.repair_number} is ready for collection.`,
};

// Fire-and-forget, never lets an SMS failure break the caller. Every
// repair-status transition in repair.service.js that triggers a
// notification calls this and ignores rejection — a customer not
// receiving an SMS must never block or roll back the underlying business
// operation (receiving a device, saving a diagnosis, marking it ready).
// Every attempt (including "not configured" and "rate limited") is still
// logged to sms_logs so an admin can see what happened.
export async function sendRepairNotification({ tenantId, repair, category, sentBy }) {
  const message = MESSAGE_TEMPLATES[category]?.(repair);
  if (!message) return { status: 'failed', reason: 'unknown_category' };
  return dispatch({ tenantId, repairId: repair.id, category, recipientPhone: repair.customer_phone, message, sentBy });
}

// Backs the manual "send custom message" action (e.g. a technician typing
// a one-off note to the customer) — same rate-limit/log/fail-safe path as
// the automatic notifications above, just with operator-supplied text
// instead of a template.
export async function sendCustomRepairMessage({ tenantId, repair, message, sentBy }) {
  return dispatch({ tenantId, repairId: repair.id, category: 'repair_custom', recipientPhone: repair.customer_phone, message, sentBy });
}

async function dispatch({ tenantId, repairId, category, recipientPhone, message, sentBy }) {
  const provider = getActiveProvider();
  const providerName = getActiveProviderName();

  if (!recipientPhone) {
    return log({ tenantId, repairId, category, recipientPhone: '', message, provider: providerName, status: 'skipped_not_configured', providerResponse: 'No customer phone number on file.', sentBy });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentInLastHour = await smsLogRepository.countSentSince(tenantId, oneHourAgo);
  if (sentInLastHour >= env.sms.rateLimitPerHour) {
    return log({ tenantId, repairId, category, recipientPhone, message, provider: providerName, status: 'skipped_rate_limited', providerResponse: `Tenant SMS rate limit (${env.sms.rateLimitPerHour}/hour) reached.`, sentBy });
  }

  let result;
  try {
    result = await provider.send({ to: recipientPhone, message });
  } catch (err) {
    result = { status: 'failed', providerResponse: err.message };
  }

  return log({ tenantId, repairId, category, recipientPhone, message, provider: providerName, status: result.status, providerResponse: result.providerResponse, sentBy });
}

async function log(entry) {
  const id = await smsLogRepository.create(entry);
  return { id, status: entry.status, providerResponse: entry.providerResponse };
}

export async function getSmsHistoryForRepair(tenantId, repairId) {
  return smsLogRepository.findForRepair(tenantId, repairId);
}
