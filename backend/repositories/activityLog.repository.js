import { pool } from '../config/db.js';

// tenantId is accepted but not yet required at every call site — some
// services haven't been threaded through with tenant context yet (tracked
// separately). When omitted, activity_logs.tenant_id falls back to its
// column DEFAULT (tenant 1), matching today's single-tenant behavior
// exactly. Pass it whenever the caller has it — findRecent() below is the
// one place this data is ever read back, and it does require tenantId.
export async function create({ tenantId, userId, branchId, description, referenceType, referenceId }) {
  if (tenantId) {
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, branch_id, description, reference_type, reference_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, userId, branchId || null, description, referenceType || null, referenceId || null],
    );
  } else {
    await pool.query(
      `INSERT INTO activity_logs (user_id, branch_id, description, reference_type, reference_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, branchId || null, description, referenceType || null, referenceId || null],
    );
  }
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