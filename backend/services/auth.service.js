import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateRandomToken,
} from '../utils/tokenUtils.js';
import {
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_MINUTES,
  PASSWORD_RESET_EXPIRY_MINUTES,
  REFRESH_TOKEN_EXPIRES_IN_REMEMBER,
  REFRESH_TOKEN_EXPIRES_IN_DEFAULT,
} from '../utils/constants.js';
import * as userRepository from '../repositories/user.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import * as refreshTokenRepository from '../repositories/refreshToken.repository.js';
import * as passwordResetRepository from '../repositories/passwordReset.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as permissionRepository from '../repositories/permission.repository.js';
import { sendMail, passwordResetEmail } from './email.service.js';
import { resolveTenant } from '../middlewares/tenantContext.js';

const BCRYPT_ROUNDS = 12;

function sanitizeUser(user) {
  const { password_hash: _passwordHash, ...safe } = user;
  return safe;
}

async function withPermissions(user) {
  const permissions = await permissionRepository.getCodesForRole(user.role_id);
  return { ...sanitizeUser(user), permissions };
}

function expiresInToMs(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
}

// Exported for reuse by tenant.service.js's register() — self-registration
// must "auto-login" with the exact same token/session bookkeeping login()
// gets, not a re-implementation of it.
export async function issueTokensForUser(user, { rememberMe, ipAddress, userAgent, deviceLabel }, permissions) {
  const refreshExpiresIn = rememberMe ? REFRESH_TOKEN_EXPIRES_IN_REMEMBER : REFRESH_TOKEN_EXPIRES_IN_DEFAULT;
  const refreshExpiresAt = new Date(Date.now() + expiresInToMs(refreshExpiresIn));

  // Placeholder hash first so the session row satisfies NOT NULL; replaced immediately below.
  const sessionId = await sessionRepository.create({
    userId: user.id,
    refreshTokenHash: 'pending',
    ipAddress,
    userAgent,
    deviceLabel,
    expiresAt: refreshExpiresAt,
  });

  const refreshToken = signRefreshToken({ sub: user.id, sid: sessionId }, refreshExpiresIn);
  const refreshTokenHash = hashToken(refreshToken);

  await sessionRepository.updateRefreshTokenHash(sessionId, refreshTokenHash, refreshExpiresAt);
  await refreshTokenRepository.create({
    userId: user.id,
    sessionId,
    tokenHash: refreshTokenHash,
    expiresAt: refreshExpiresAt,
  });

  // `permissions` is embedded in the access token as a convenience for the
  // frontend (so it can read user.permissions off the decoded/response-body
  // user without a separate round trip) — it is NOT what authorize()
  // trusts for enforcement. That middleware keeps querying
  // permissionRepository.getCodesForRole() (with its own short-lived cache)
  // on every request, so a permission revoked mid-session still takes
  // effect within that cache window instead of only at token expiry.
  const accessToken = signAccessToken({
    sub: user.id, tenantId: user.tenant_id, roleId: user.role_id, role: user.role_name, branchId: user.branch_id, permissions,
  });

  return { accessToken, refreshToken, refreshExpiresAt };
}

export async function login({ identifier, password, rememberMe, ipAddress, userAgent, deviceLabel }) {
  const user = await userRepository.findByEmailOrUsername(identifier);
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (user.status !== 'active') {
    throw new ApiError(403, 'This account is not active. Contact your administrator.');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new ApiError(403, 'This account is temporarily locked due to repeated failed login attempts. Try again later.');
  }

  // Rejects login outright for a suspended tenant, rather than issuing a
  // token that would only fail on the user's very next request (see
  // authenticate.js, which runs this exact same check for every subsequent
  // request from the resulting token).
  await resolveTenant(user.tenant_id);

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    await userRepository.incrementFailedAttemptsAndMaybeLock(user.id, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES);
    throw new ApiError(401, 'Invalid credentials');
  }

  await userRepository.resetFailedAttempts(user.id);
  await userRepository.updateLastLogin(user.id);
  await activityLogRepository.create({
    tenantId: user.tenant_id,
    userId: user.id,
    branchId: user.branch_id,
    description: `${user.first_name} ${user.last_name} logged in`,
    referenceType: 'auth.login',
    referenceId: user.id,
  });

  const userWithPermissions = await withPermissions(user);
  const tokens = await issueTokensForUser(user, { rememberMe, ipAddress, userAgent, deviceLabel }, userWithPermissions.permissions);

  return { ...tokens, user: userWithPermissions };
}

export async function refresh({ refreshToken }) {
  if (!refreshToken) {
    throw new ApiError(401, 'Missing refresh token');
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }

  const tokenHash = hashToken(refreshToken);
  const storedToken = await refreshTokenRepository.findValidByHash(tokenHash);
  if (!storedToken || storedToken.user_id !== payload.sub) {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || user.status !== 'active') {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }
  await resolveTenant(user.tenant_id);

  // Rotate: revoke the presented refresh token, issue a new one on the same session.
  await refreshTokenRepository.revoke(storedToken.id);

  const refreshExpiresAt = new Date(Date.now() + expiresInToMs(REFRESH_TOKEN_EXPIRES_IN_DEFAULT));
  const newRefreshToken = signRefreshToken({ sub: user.id, sid: payload.sid }, REFRESH_TOKEN_EXPIRES_IN_DEFAULT);
  const newRefreshTokenHash = hashToken(newRefreshToken);

  await sessionRepository.updateRefreshTokenHash(payload.sid, newRefreshTokenHash, refreshExpiresAt);
  await refreshTokenRepository.create({
    userId: user.id,
    sessionId: payload.sid,
    tokenHash: newRefreshTokenHash,
    expiresAt: refreshExpiresAt,
  });

  // Recomputed fresh from the DB on every refresh (not carried over from the
  // old access token's claim) so a permission change made mid-session is
  // reflected in the new token within one refresh cycle, same as the login
  // path — see the comment in issueTokensForUser() for why authorize()
  // still doesn't trust this claim directly.
  const userWithPermissions = await withPermissions(user);
  const accessToken = signAccessToken({
    sub: user.id, tenantId: user.tenant_id, roleId: user.role_id, role: user.role_name, branchId: user.branch_id, permissions: userWithPermissions.permissions,
  });

  return { accessToken, refreshToken: newRefreshToken, refreshExpiresAt, user: userWithPermissions };
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return;

  try {
    const payload = verifyRefreshToken(refreshToken);
    await sessionRepository.revoke(payload.sid);
    await refreshTokenRepository.revokeAllForSession(payload.sid);
  } catch {
    // Token already invalid/expired — nothing to revoke, treat logout as a no-op success.
  }
}

export async function logoutAll(userId) {
  await sessionRepository.revokeAllForUser(userId);
  await refreshTokenRepository.revokeAllForUser(userId);
}

export async function getMe(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return withPermissions(user);
}

export async function listSessions(userId) {
  return sessionRepository.findActiveByUser(userId);
}

export async function revokeSession(userId, sessionId) {
  const session = await sessionRepository.findById(sessionId);
  if (!session || session.user_id !== userId) {
    throw new ApiError(404, 'Session not found');
  }
  await sessionRepository.revoke(sessionId);
  await refreshTokenRepository.revokeAllForSession(sessionId);
}

// Always resolves successfully regardless of whether the email exists, to avoid user enumeration.
export async function forgotPassword({ email, frontendUrl = env.frontendUrl }) {
  const user = await userRepository.findByEmailOrUsername(email);
  if (!user) return;

  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60000);

  await passwordResetRepository.create({ userId: user.id, tokenHash, expiresAt });

  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
  const { subject, html, template } = passwordResetEmail(resetUrl, user.preferred_language);
  await sendMail({ to: user.email, subject, html, template });
}

export async function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token);
  const resetRecord = await passwordResetRepository.findValidByHash(tokenHash);
  if (!resetRecord) {
    throw new ApiError(400, 'This reset link is invalid or has expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userRepository.updatePasswordHash(resetRecord.user_id, passwordHash);
  await passwordResetRepository.markUsed(resetRecord.id);

  // Force re-login everywhere after a password reset.
  await sessionRepository.revokeAllForUser(resetRecord.user_id);
  await refreshTokenRepository.revokeAllForUser(resetRecord.user_id);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function updateOwnProfile(userId, data) {
  const user = await userRepository.updateOwnProfile(userId, data);
  return withPermissions(user);
}

export async function updateLanguagePreference(userId, preferredLanguage) {
  const user = await userRepository.updatePreferredLanguage(userId, preferredLanguage);
  return withPermissions(user);
}

// Unlike an admin resetting someone else's password (no current-password
// check, gated by users.edit), changing your own password requires proving
// you know the old one. Revokes every session afterward — the same
// force-relogin behavior resetPassword() already uses — so a stolen access
// token can't outlive a password change.
export async function changeOwnPassword(userId, { currentPassword, newPassword }) {
  const user = await userRepository.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) throw new ApiError(401, 'Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userRepository.updatePasswordHash(userId, passwordHash);

  await sessionRepository.revokeAllForUser(userId);
  await refreshTokenRepository.revokeAllForUser(userId);
}
