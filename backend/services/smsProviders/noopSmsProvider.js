// The default provider whenever SMS_PROVIDER is unset or unrecognized.
// Never sends anything, never throws, never pretends a message went out —
// it exists so the rest of the codebase (repair.service.js's notification
// hooks, the manual "send SMS" endpoint) can always call sms.service.js
// without branching on whether SMS is configured. sms.service.js logs the
// resulting 'skipped_not_configured' status to sms_logs exactly like a
// real send attempt, so the gap is visible in the log, not silent.

export const PROVIDER_NAME = 'none';

export async function send() {
  return { status: 'skipped_not_configured', providerResponse: null };
}
