import { pool } from '../config/db.js';

export async function create({ platformAdminId, tokenHash, ipAddress, userAgent, expiresAt }) {
  const [result] = await pool.query(
    'INSERT INTO platform_refresh_tokens (platform_admin_id, token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
    [platformAdminId, tokenHash, ipAddress || null, userAgent || null, expiresAt],
  );
  return result.insertId;
}

export async function findValidByHash(tokenHash) {
  const [rows] = await pool.query(
    'SELECT * FROM platform_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1',
    [tokenHash],
  );
  return rows[0] || null;
}

export async function revoke(id) {
  await pool.query('UPDATE platform_refresh_tokens SET revoked_at = NOW() WHERE id = ?', [id]);
}

export async function revokeAllForAdmin(platformAdminId) {
  await pool.query(
    'UPDATE platform_refresh_tokens SET revoked_at = NOW() WHERE platform_admin_id = ? AND revoked_at IS NULL',
    [platformAdminId],
  );
}
