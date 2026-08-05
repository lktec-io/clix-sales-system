import bcrypt from 'bcrypt';
import { ApiError } from '../utils/apiError.js';
import {
  signPlatformAccessToken,
  signPlatformRefreshToken,
  verifyPlatformRefreshToken,
} from '../utils/platformTokenUtils.js';
import { hashToken } from '../utils/tokenUtils.js';
import { MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES } from '../utils/constants.js';
import * as platformAdminRepository from '../repositories/platformAdmin.repository.js';
import * as platformRefreshTokenRepository from '../repositories/platformRefreshToken.repository.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRES_IN = '7d';

function sanitizeAdmin(admin) {
  const { password_hash: _passwordHash, failed_login_attempts: _f, locked_until: _l, ...safe } = admin;
  return safe;
}

function expiresInToMs(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
}

async function issueTokens(admin, { ipAddress, userAgent }) {
  const accessToken = signPlatformAccessToken({ sub: admin.id, type: 'platform_admin' });
  const refreshToken = signPlatformRefreshToken({ sub: admin.id, type: 'platform_admin' }, REFRESH_TOKEN_EXPIRES_IN);
  const refreshExpiresAt = new Date(Date.now() + expiresInToMs(REFRESH_TOKEN_EXPIRES_IN));

  await platformRefreshTokenRepository.create({
    platformAdminId: admin.id,
    tokenHash: hashToken(refreshToken),
    ipAddress,
    userAgent,
    expiresAt: refreshExpiresAt,
  });

  return { accessToken, refreshToken, refreshExpiresAt };
}

export async function login({ email, password, ipAddress, userAgent }) {
  const admin = await platformAdminRepository.findByEmail(email);
  if (!admin) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (admin.status !== 'active') {
    throw new ApiError(403, 'This platform admin account is not active.');
  }

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    throw new ApiError(403, 'This account is temporarily locked due to repeated failed login attempts. Try again later.');
  }

  const passwordMatches = await bcrypt.compare(password, admin.password_hash);
  if (!passwordMatches) {
    await platformAdminRepository.incrementFailedAttemptsAndMaybeLock(admin.id, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES);
    throw new ApiError(401, 'Invalid credentials');
  }

  await platformAdminRepository.resetFailedAttempts(admin.id);
  await platformAdminRepository.updateLastLogin(admin.id);

  const tokens = await issueTokens(admin, { ipAddress, userAgent });
  return { ...tokens, admin: sanitizeAdmin(admin) };
}

export async function refresh({ refreshToken }) {
  if (!refreshToken) {
    throw new ApiError(401, 'Missing refresh token');
  }

  let payload;
  try {
    payload = verifyPlatformRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }

  const tokenHash = hashToken(refreshToken);
  const storedToken = await platformRefreshTokenRepository.findValidByHash(tokenHash);
  if (!storedToken || storedToken.platform_admin_id !== payload.sub) {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }

  const admin = await platformAdminRepository.findById(payload.sub);
  if (!admin || admin.status !== 'active') {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }

  // Rotate: revoke the presented refresh token, issue a new one.
  await platformRefreshTokenRepository.revoke(storedToken.id);
  const tokens = await issueTokens(admin, {
    ipAddress: storedToken.ip_address,
    userAgent: storedToken.user_agent,
  });

  return { ...tokens, admin: sanitizeAdmin(admin) };
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return;

  try {
    const payload = verifyPlatformRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const storedToken = await platformRefreshTokenRepository.findValidByHash(tokenHash);
    if (storedToken && storedToken.platform_admin_id === payload.sub) {
      await platformRefreshTokenRepository.revoke(storedToken.id);
    }
  } catch {
    // Token already invalid/expired — nothing to revoke, treat logout as a no-op success.
  }
}

export async function getMe(platformAdminId) {
  const admin = await platformAdminRepository.findById(platformAdminId);
  if (!admin) throw new ApiError(404, 'Platform admin not found');
  return sanitizeAdmin(admin);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
