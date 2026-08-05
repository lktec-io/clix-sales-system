import { pool } from '../config/db.js';

export async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM platform_admins WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM platform_admins WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findAllActive() {
  const [rows] = await pool.query("SELECT id, first_name, last_name, email FROM platform_admins WHERE status = 'active'");
  return rows;
}

export async function incrementFailedAttemptsAndMaybeLock(id, maxAttempts, lockMinutes) {
  await pool.query(
    `UPDATE platform_admins
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = IF(failed_login_attempts + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until)
     WHERE id = ?`,
    [maxAttempts, lockMinutes, id],
  );
}

export async function resetFailedAttempts(id) {
  await pool.query('UPDATE platform_admins SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [id]);
}

export async function updateLastLogin(id) {
  await pool.query('UPDATE platform_admins SET last_login_at = NOW() WHERE id = ?', [id]);
}
