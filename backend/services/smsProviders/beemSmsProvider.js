import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// Beem Africa SMS API — implemented against the OFFICIAL beem-africa
// GitHub organization's Python client source (github.com/beem-africa/
// python-client, BeemAfrica/SMS.py + BeemAfrica/__init__.py), read
// directly, since the interactive docs.beem.africa portal is a
// JS-rendered SPA this environment cannot execute. This is Beem's own
// reference implementation, not a third-party guess:
//   - Endpoint: POST https://apisms.beem.africa/v1/send
//   - Auth: HTTP Basic, base64(api_key:secret_key), in the Authorization
//     header — built fresh per-request below, never logged.
//   - Request body: { source_addr, schedule_time, encoding, message,
//     recipients: [{ recipient_id, dest_addr }] } — field names verbatim
//     from BeemAfrica/SMS.py's get_body().
//   - Success response shape (confirmed via Beem's own published SMS
//     guide example): { successful: true, request_id, code, message,
//     valid, invalid, duplicates }.
// Cross-checked against a second, independent official-org-adjacent
// client (github.com/Jkarage/beemafrica, Go) — same endpoint, same field
// names, same response shape confirmed independently. That client does
// note a real Beem process for sender IDs: `dest_addr`/`source_addr`
// aside, a Sender ID must be requested and approved through Beem's own
// sender-names endpoint before it can be used — an unapproved
// BEEM_SENDER_ID will be rejected by Beem, not by this code.
//
// What is NOT independently confirmed: the full catalog of failure
// `code` values — this implementation treats any response where
// `successful` isn't strictly `true` as a failure and surfaces Beem's own
// `message`/`code` verbatim rather than trying to interpret every
// possible failure code, so nothing here invents behavior Beem hasn't
// documented.

export const PROVIDER_NAME = 'beem';

function isConfigured() {
  return Boolean(env.sms.beem.apiKey && env.sms.beem.secretKey && env.sms.beem.senderId && env.sms.beem.baseUrl);
}

export async function send({ to, message }) {
  if (!isConfigured()) {
    return { status: 'skipped_not_configured', providerResponse: 'Beem credentials are incomplete.' };
  }

  // `to` arrives here already validated and normalized to Beem's expected
  // digits-only, country-code-prefixed shape (e.g. "255712345678") by
  // sms.service.js#dispatch — the one shared, provider-agnostic place phone
  // handling lives, so this stays a thin, Beem-contract-only translation.
  const authHeader = `Basic ${Buffer.from(`${env.sms.beem.apiKey}:${env.sms.beem.secretKey}`).toString('base64')}`;
  const body = {
    source_addr: env.sms.beem.senderId,
    schedule_time: '',
    encoding: 0,
    message,
    recipients: [{ recipient_id: 1, dest_addr: to }],
  };

  let response;
  try {
    response = await fetch(`${env.sms.beem.baseUrl}/v1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // Never log `body`/`authHeader` — only the network-level failure reason.
    logger.error('Beem SMS request failed (network/timeout)', { message: err.message });
    return { status: 'failed', providerResponse: 'Could not reach the SMS provider.' };
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.successful !== true) {
    logger.error('Beem SMS request rejected', { status: response.status, code: payload?.code, message: payload?.message });
    return {
      status: 'failed',
      providerResponse: payload?.message ? `Beem: ${payload.message} (code ${payload.code ?? 'unknown'})` : `Beem SMS request failed (HTTP ${response.status}).`,
    };
  }

  return { status: 'sent', providerResponse: `request_id ${payload.request_id}` };
}
