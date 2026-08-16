import { env } from '../config/env.js';
import * as smsLogRepository from '../repositories/smsLog.repository.js';
import { getActiveProvider, getActiveProviderName } from './smsProviders/index.js';
import { normalizeTanzanianPhone } from '../utils/phoneUtils.js';

// Every customer-facing repair SMS is Swahili — the customer base this
// message reaches, not the operator's own dashboard language (an
// English-UI technician's customer still gets a Swahili SMS). Kept short
// enough to stay a single SMS segment and free of emoji, per the agreed
// templates.
const MESSAGE_TEMPLATES = {
  repair_received: (repair) => `Habari ${repair.customer_first_name}, kifaa chako kimepokelewa kwa ajili ya matengenezo. Namba ya kazi ni ${repair.repair_number}. Tutakujulisha hatua inayofuata. Asante.`,
  repair_diagnosis_update: (repair) => `Habari ${repair.customer_first_name}, uchunguzi wa kifaa chako umekamilika. Tafadhali wasiliana nasi kwa taarifa zaidi kuhusu gharama na matengenezo. Kazi Na. ${repair.repair_number}.`,
  repair_ready_for_collection: (repair) => `Habari ${repair.customer_first_name}, kifaa chako kimetengenezwa na kiko tayari kuchukuliwa. Kazi Na. ${repair.repair_number}. Asante kwa kutuamini.`,
  repair_completed: (repair) => `Habari ${repair.customer_first_name}, asante kwa kuchagua huduma yetu. Kazi Na. ${repair.repair_number} imekamilika. Karibu tena.`,
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

  // Validated and normalized here — the one place every send path (automatic
  // repair notifications and the manual custom-message endpoint alike)
  // passes through — so an obviously malformed number never reaches a
  // provider's API call at all, and every provider always receives the
  // same clean "255XXXXXXXXX" shape regardless of how the customer's phone
  // was originally typed at intake.
  const normalizedPhone = normalizeTanzanianPhone(recipientPhone);
  if (!normalizedPhone) {
    return log({ tenantId, repairId, category, recipientPhone, message, provider: providerName, status: 'skipped_invalid_phone', providerResponse: 'Recipient phone number is not a valid Tanzanian mobile number.', sentBy });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentInLastHour = await smsLogRepository.countSentSince(tenantId, oneHourAgo);
  if (sentInLastHour >= env.sms.rateLimitPerHour) {
    return log({ tenantId, repairId, category, recipientPhone: normalizedPhone, message, provider: providerName, status: 'skipped_rate_limited', providerResponse: `Tenant SMS rate limit (${env.sms.rateLimitPerHour}/hour) reached.`, sentBy });
  }

  let result;
  try {
    result = await provider.send({ to: normalizedPhone, message });
  } catch (err) {
    result = { status: 'failed', providerResponse: err.message };
  }

  return log({ tenantId, repairId, category, recipientPhone: normalizedPhone, message, provider: providerName, status: result.status, providerResponse: result.providerResponse, sentBy });
}

async function log(entry) {
  const id = await smsLogRepository.create(entry);
  return { id, status: entry.status, providerResponse: entry.providerResponse };
}

export async function getSmsHistoryForRepair(tenantId, repairId) {
  return smsLogRepository.findForRepair(tenantId, repairId);
}
