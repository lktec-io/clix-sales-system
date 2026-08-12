import { env } from '../../config/env.js';
import * as noopSmsProvider from './noopSmsProvider.js';
import * as beemSmsProvider from './beemSmsProvider.js';

// Mirrors paymentProviders/index.js's exact registry shape. Adding a real
// SMS provider later means: implement { PROVIDER_NAME, send({ to, message }) }
// in a new module, register it here, and set SMS_PROVIDER — nothing in
// sms.service.js or its callers needs to change.
const PROVIDERS = {
  [noopSmsProvider.PROVIDER_NAME]: noopSmsProvider,
  [beemSmsProvider.PROVIDER_NAME]: beemSmsProvider,
};

export function getActiveProviderName() {
  const configured = env.sms.provider;
  return PROVIDERS[configured] ? configured : noopSmsProvider.PROVIDER_NAME;
}

export function getActiveProvider() {
  return PROVIDERS[getActiveProviderName()];
}
