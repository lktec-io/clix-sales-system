import 'dotenv/config';
import crypto from 'crypto';

const REQUIRED_VARS = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
];

function requireEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key] && process.env[key] !== '');
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

requireEnv();

// Platform-admin JWTs need a signing secret genuinely distinct from the
// tenant JWT_ACCESS_SECRET/JWT_REFRESH_SECRET, so a tenant token can never
// verify against the platform's verify function (or vice versa) — see
// backend/middlewares/authenticatePlatform.js. Adding two more *required*
// env vars would make this app fail to boot on every existing deployment
// the moment this code ships, until .env is updated there first — a real
// outage risk for a production system with live tenants, for a portal only
// the platform owner uses. Optional overrides (JWT_PLATFORM_ACCESS_SECRET/
// JWT_PLATFORM_REFRESH_SECRET) let an operator set fully independent
// secrets whenever convenient; until then, a deterministic HMAC-derived
// fallback (one-way — a tenant secret can't be recovered from it, and it
// can't be used to forge a tenant token) keeps the two token spaces
// cryptographically separate with zero deploy risk.
function derivePlatformSecret(label) {
  return crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET).update(label).digest('hex');
}

const platformAccessSecret = process.env.JWT_PLATFORM_ACCESS_SECRET || derivePlatformSecret('platform-access-v1');
const platformRefreshSecret = process.env.JWT_PLATFORM_REFRESH_SECRET || derivePlatformSecret('platform-refresh-v1');

if (!process.env.JWT_PLATFORM_ACCESS_SECRET || !process.env.JWT_PLATFORM_REFRESH_SECRET) {
  // config/logger.js imports this file, so it can't be used here without a cycle
  console.warn(
    '[env] JWT_PLATFORM_ACCESS_SECRET/JWT_PLATFORM_REFRESH_SECRET not set — deriving platform JWT secrets from JWT_ACCESS_SECRET. '
    + 'Set both explicitly in production for fully independent platform-admin signing keys.',
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT),

  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    refreshExpiresInShort: process.env.JWT_REFRESH_EXPIRES_IN_SHORT || '1d',
    platformAccessSecret,
    platformRefreshSecret,
    platformAccessExpiresIn: process.env.JWT_PLATFORM_ACCESS_EXPIRES_IN || '15m',
    platformRefreshExpiresIn: process.env.JWT_PLATFORM_REFRESH_EXPIRES_IN || '7d',
  },

  frontendUrl: process.env.FRONTEND_URL,

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'no-reply@sales.clixworks.co.tz',
  },

  // Primary storage for uploaded images (avatars, company logo, product
  // images) — see backend/config/cloudinary.js and backend/middlewares/
  // upload.js. Not in REQUIRED_VARS so a developer without credentials
  // still boots fine and transparently gets the local-disk fallback.
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // Phase 6B — see backend/services/paymentProviders/azampayPaymentProvider
  // .js. Not in REQUIRED_VARS: with these unset, PAYMENT_PROVIDER stays
  // (or falls back to) 'manual', so an environment without AzamPay
  // credentials still boots and runs fine on the existing manual/offline
  // payment path — exactly the same "optional, graceful fallback" pattern
  // cloudinary above already uses.
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'manual',
    azampay: {
      appName: process.env.AZAMPAY_APP_NAME || '',
      clientId: process.env.AZAMPAY_CLIENT_ID || '',
      clientSecret: process.env.AZAMPAY_CLIENT_SECRET || '',
      authUrl: process.env.AZAMPAY_AUTH_URL || 'https://authenticator-sandbox.azampay.co.tz',
      checkoutUrl: process.env.AZAMPAY_CHECKOUT_URL || 'https://sandbox.azampay.co.tz',
      // Not confirmed against AzamPay's current merchant documentation —
      // see azampayPaymentProvider.js's own header comment. Left unset,
      // verifyWebhookSignature() fails closed (rejects every callback)
      // rather than silently accepting unverified ones.
      callbackSecret: process.env.AZAMPAY_CALLBACK_SECRET || '',
    },
  },
};
