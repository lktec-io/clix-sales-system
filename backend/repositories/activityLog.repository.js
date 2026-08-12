import { pool } from '../config/db.js';

// tenantId is required, not defaulted. It used to silently fall back to
// the column's DEFAULT (tenant 1) when omitted — that was a real bug (see
// product.service.js/user.service.js history): every activity from every
// tenant OTHER than tenant 1 was silently logged against tenant 1,
// vanishing from the acting tenant's own feed and leaking into tenant 1's.
// All 83 call sites across services/*.js now pass tenantId explicitly
// (verified), so failing loudly here for any future caller that forgets
// it is strictly safer than silently misattributing the row again.
export async function create({ tenantId, userId, branchId, description, referenceType, referenceId }) {
  if (!tenantId) throw new Error('activityLogRepository.create() requires tenantId');
  await pool.query(
    `INSERT INTO activity_logs (tenant_id, user_id, branch_id, description, reference_type, reference_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, userId, branchId || null, description, referenceType || null, referenceId || null],
  );
}

export async function findRecent(tenantId, limit = 20) {
  const [rows] = await pool.query(
    `SELECT a.id, a.description, a.reference_type, a.reference_id, a.created_at,
            u.first_name, u.last_name, a.branch_id
     FROM activity_logs a
     JOIN users u ON u.id = a.user_id
     WHERE a.tenant_id = ?
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [tenantId, limit],
  );
  return rows;
}