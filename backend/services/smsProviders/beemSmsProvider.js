// Scaffold only — send() below is deliberately NOT implemented against
// Beem Africa's live SMS API. This codebase has no verified Beem API
// contract (exact endpoint path, authentication header/scheme, request
// body field names, response shape, or error codes), and per explicit
// instruction this file must not invent one. Real credentials will be
// entered directly on the VPS (env.sms.beem.* — see config/env.js —
// already reads BEEM_API_KEY/BEEM_SECRET_KEY/BEEM_SENDER_ID/BEEM_BASE_URL,
// wired and ready to use once this file is finished).
//
// Before implementing send() for real: confirm against Beem's own current
// merchant/developer documentation — (1) the exact request endpoint and
// HTTP method, (2) whether auth is HTTP Basic (api_key:secret_key) or a
// header/token scheme, (3) the exact JSON field names for sender ID,
// recipient list, and message body, (4) the shape of a success vs failure
// response, and (5) whether delivery is synchronous or reported later via
// a callback. Do not guess any of these — verify each one, then replace
// the throw below with the real HTTP call.
//
// Until then, selecting SMS_PROVIDER=beem is safe, not fake: it fails
// closed with a clear, logged reason rather than pretending to send.

import { env } from '../../config/env.js';

export const PROVIDER_NAME = 'beem';

export async function send() {
  if (!env.sms.beem.apiKey || !env.sms.beem.secretKey || !env.sms.beem.senderId || !env.sms.beem.baseUrl) {
    return { status: 'skipped_not_configured', providerResponse: 'Beem credentials are incomplete.' };
  }
  return {
    status: 'failed',
    providerResponse: 'Beem SMS sending is not yet implemented — the live API contract has not been confirmed. See this file\'s header comment.',
  };
}
