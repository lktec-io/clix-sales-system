// Sibling to tokenUtils.js, not a modification of it — platform-admin
// tokens are signed/verified against a completely separate secret
// (env.jwt.platformAccessSecret/platformRefreshSecret, see config/env.js),
// so this file shares no verification code path with the tenant one.
// hashToken()/generateRandomToken() are pure and tenant-agnostic and are
// reused directly from tokenUtils.js rather than duplicated here.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const JWT_ALGORITHM = 'HS256';

export function signPlatformAccessToken(payload) {
  return jwt.sign(payload, env.jwt.platformAccessSecret, { expiresIn: env.jwt.platformAccessExpiresIn, algorithm: JWT_ALGORITHM });
}

export function signPlatformRefreshToken(payload, expiresIn) {
  return jwt.sign(payload, env.jwt.platformRefreshSecret, { expiresIn, algorithm: JWT_ALGORITHM });
}

export function verifyPlatformAccessToken(token) {
  return jwt.verify(token, env.jwt.platformAccessSecret, { algorithms: [JWT_ALGORITHM] });
}

export function verifyPlatformRefreshToken(token) {
  return jwt.verify(token, env.jwt.platformRefreshSecret, { algorithms: [JWT_ALGORITHM] });
}
