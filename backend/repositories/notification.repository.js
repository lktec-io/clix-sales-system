import { pool } from '../config/db.js';

// Fan-out on write: every notification row belongs to exactly one user, so
// "mark as read" is always unambiguous — no shared row two people could
// race to mark read/unread for each other. notifyBranchManagement() is how
// callers reach "everyone who should know" without a NULL-user broadcast
// row that would make per-user read-state meaningless.
//
// tenantId is required — without it, since `roles` is a shared/global
// table, the Super Administrator clause would match every tenant's Super
// Admin, not just this one's, and notify them about another tenant's
// sale/purchase/expense. u.tenant_id = ? closes that off; the Manager
// clause is already branch-scoped, but branches themselves are
// tenant-owned, so this is defense-in-depth there too.
export async function notifyBranchManagement(tenantId, branchId, { type = 'info', category, title, message, referenceType, referenceId }) {
  await pool.query(
    `INSERT INTO notifications (user_id, type, category, title, message, reference_type, reference_id)
     SELECT u.id, ?, ?, ?, ?, ?, ?
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.status = 'active' AND u.tenant_id = ? AND (
       r.name = 'Super Administrator'
       OR (r.name = 'Manager' AND (u.branch_id = ? OR u.id IN (SELECT user_id FROM user_branches WHERE branch_id = ?)))
     )`,
    [type, category, title, message, referenceType || null, referenceId || null, tenantId, branchId, branchId],
  );
}

export async function findAllForUser({ userId, page = 1, limit = 20, status }) {
  const conditions = ['user_id = ?'];
  const params = [userId];

  if (status === 'unread') conditions.push('read_at IS NULL');
  else if (status === 'read') conditions.push('read_at IS NOT NULL');

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM notifications ${whereClause}`, params);

  return { rows, total };
}

export async function getUnreadCount(userId) {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
  return Number(count);
}

export async function markRead(id, userId) {
  const [result] = await pool.query(
    'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL',
    [id, userId],
  );
  return result.affectedRows > 0;
}

export async function markAllRead(userId) {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [userId]);
}

// Real DELETEs, scoped to user_id so a user can only ever delete their own
// notifications (never someone else's, even by guessing an id).
export async function deleteOne(id, userId) {
  const [result] = await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

export async function deleteAllForUser(userId) {
  await pool.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
}
