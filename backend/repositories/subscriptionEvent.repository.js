import { pool } from '../config/db.js';

// Append-only — no update()/delete() exported from this file, ever. Serves
// Step 3's "Upgrade History"/"Downgrade History" as a filtered read of this
// one table (eventType is an optional filter, not a separate table).
export async function create({ tenantId, subscriptionId, eventType, fromPlanId, toPlanId, fromCycle, toCycle, effectiveDate, reason, platformAdminId }) {
  const [result] = await pool.query(
    `INSERT INTO subscription_events
       (tenant_id, subscription_id, event_type, from_plan_id, to_plan_id, from_cycle, to_cycle, effective_date, reason, platform_admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId, subscriptionId, eventType, fromPlanId || null, toPlanId || null, fromCycle || null, toCycle || null,
      effectiveDate, reason || null, platformAdminId || null,
    ],
  );
  return result.insertId;
}

export async function listForTenant(tenantId, { page = 1, limit = 20, eventType } = {}) {
  const conditions = ['se.tenant_id = ?'];
  const params = [tenantId];

  if (eventType) {
    conditions.push('se.event_type = ?');
    params.push(eventType);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT se.*, fp.name AS from_plan_name, tp.name AS to_plan_name
     FROM subscription_events se
     LEFT JOIN subscription_plans fp ON fp.id = se.from_plan_id
     LEFT JOIN subscription_plans tp ON tp.id = se.to_plan_id
     ${whereClause}
     ORDER BY se.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM subscription_events se ${whereClause}`, params);

  return { rows, total };
}
