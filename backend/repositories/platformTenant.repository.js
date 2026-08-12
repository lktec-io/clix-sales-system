import { pool } from '../config/db.js';

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findAll({ page = 1, limit = 20, search, status, subscriptionStatus }) {
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    conditions.push('(company_name LIKE ? OR company_code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  } else {
    // No explicit status filter — keep the default "browse my tenants"
    // view clean by excluding deleted ones, mirroring how a normal file
    // browser hides its trash by default. Still fully reachable via the
    // status filter (status = 'deleted') — nothing is hidden, just not
    // cluttering the everyday view.
    conditions.push("status != 'deleted'");
  }
  if (subscriptionStatus) {
    conditions.push('subscription_status = ?');
    params.push(subscriptionStatus);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM tenants ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM tenants ${whereClause}`, params);

  return { rows, total };
}

// One aggregate round trip for every status/subscription_status KPI tile —
// not one COUNT per tile — index-backed by idx_tenants_status/
// idx_tenants_subscription_status (023_add_tenant_management_indexes.sql).
export async function getKpiCounts() {
  const [rows] = await pool.query(
    'SELECT status, subscription_status, COUNT(*) AS total FROM tenants GROUP BY status, subscription_status',
  );

  const counts = {
    total: 0, active: 0, trial: 0, expired: 0, suspended: 0, deleted: 0,
  };
  for (const row of rows) {
    const total = Number(row.total);
    // A deleted (closed) tenant isn't a "real" tenant for headline KPI
    // purposes — tracked in its own bucket, excluded from `total`, exactly
    // like the trash folder of a mail client isn't counted in "total
    // emails".
    if (row.status === 'deleted') {
      counts.deleted += total;
      continue;
    }
    counts.total += total;
    if (row.status === 'suspended') counts.suspended += total;
    else if (row.subscription_status === 'trial') counts.trial += total;
    else if (row.subscription_status === 'expired') counts.expired += total;
    else if (row.subscription_status === 'active') counts.active += total;
  }
  return counts;
}

// One query, three CASE-summed windows — not three separate COUNTs.
export async function getRegistrationCounts() {
  const [[row]] = await pool.query(`
    SELECT
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END) AS thisMonth,
      SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS last30Days
    FROM tenants
  `);
  return {
    today: Number(row.today) || 0,
    thisMonth: Number(row.thisMonth) || 0,
    last30Days: Number(row.last30Days) || 0,
  };
}

export async function getCompanyInfo(tenantId) {
  const [rows] = await pool.query('SELECT * FROM company_settings WHERE tenant_id = ? LIMIT 1', [tenantId]);
  return rows[0] || null;
}

// The tenant's Super Administrator — "the owner" for display purposes.
export async function getOwner(tenantId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status, u.last_login_at, u.created_at
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.tenant_id = ? AND r.name = 'Super Administrator' AND u.deleted_at IS NULL
     ORDER BY u.created_at ASC LIMIT 1`,
    [tenantId],
  );
  return rows[0] || null;
}

export async function countUsers(tenantId) {
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM users WHERE tenant_id = ? AND deleted_at IS NULL',
    [tenantId],
  );
  return Number(total);
}

export async function countBranches(tenantId) {
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM branches WHERE tenant_id = ? AND deleted_at IS NULL',
    [tenantId],
  );
  return Number(total);
}

export async function listBranches(tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name, code, status, created_at FROM branches WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at ASC',
    [tenantId],
  );
  return rows;
}

export async function listUsers(tenantId, { page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.last_login_at, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.tenant_id = ? AND u.deleted_at IS NULL
     ORDER BY u.created_at ASC LIMIT ? OFFSET ?`,
    [tenantId, limit, offset],
  );
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM users WHERE tenant_id = ? AND deleted_at IS NULL',
    [tenantId],
  );
  return { rows, total };
}

export async function getRecentLogins(tenantId, limit = 10) {
  const [rows] = await pool.query(
    `SELECT s.id, s.ip_address, s.user_agent, s.created_at, u.first_name, u.last_name, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE u.tenant_id = ?
     ORDER BY s.created_at DESC LIMIT ?`,
    [tenantId, limit],
  );
  return rows;
}

// --- Trial/status actions — every one a single column UPDATE, never a
// DELETE. Callers (platformTenant.service.js) are responsible for calling
// invalidateTenantCache(tenantId) and writing an audit-log row afterward. ---

export async function suspend(tenantId) {
  await pool.query("UPDATE tenants SET status = 'suspended' WHERE id = ?", [tenantId]);
  return findById(tenantId);
}

export async function activate(tenantId) {
  await pool.query("UPDATE tenants SET status = 'active' WHERE id = ?", [tenantId]);
  return findById(tenantId);
}

// See 036_add_deleted_tenant_status.sql for why this is a status flip, not
// a real DELETE. Guarded by `AND status != 'deleted'` so a double-submit
// or a stale confirmation dialog can never re-run this on an
// already-deleted tenant.
export async function softDelete(tenantId) {
  const [result] = await pool.query("UPDATE tenants SET status = 'deleted' WHERE id = ? AND status != 'deleted'", [tenantId]);
  return { affected: result.affectedRows > 0, tenant: await findById(tenantId) };
}

export async function restore(tenantId) {
  await pool.query("UPDATE tenants SET status = 'active' WHERE id = ? AND status = 'deleted'", [tenantId]);
  return findById(tenantId);
}

export async function extendTrial(tenantId, days) {
  await pool.query(
    "UPDATE tenants SET subscription_status = 'trial', trial_ends_at = DATE_ADD(GREATEST(trial_ends_at, NOW()), INTERVAL ? DAY) WHERE id = ?",
    [days, tenantId],
  );
  return findById(tenantId);
}

export async function reduceTrial(tenantId, days) {
  await pool.query(
    'UPDATE tenants SET trial_ends_at = GREATEST(DATE_SUB(trial_ends_at, INTERVAL ? DAY), DATE_ADD(NOW(), INTERVAL 1 HOUR)) WHERE id = ?',
    [days, tenantId],
  );
  return findById(tenantId);
}

export async function resetTrial(tenantId, days) {
  await pool.query(
    "UPDATE tenants SET subscription_status = 'trial', trial_started_at = NOW(), trial_ends_at = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE id = ?",
    [days, tenantId],
  );
  return findById(tenantId);
}

export async function activateSubscriptionManually(tenantId) {
  await pool.query("UPDATE tenants SET subscription_status = 'active' WHERE id = ?", [tenantId]);
  return findById(tenantId);
}

export async function expireImmediately(tenantId) {
  await pool.query("UPDATE tenants SET subscription_status = 'expired', trial_ends_at = NOW() WHERE id = ?", [tenantId]);
  return findById(tenantId);
}

// --- Notification-sweep support queries (platformNotificationJob.js) ---
// Each is one bounded, index-backed query with an embedded NOT EXISTS —
// not a loop of per-tenant existence checks — so the sweep's cost stays
// flat regardless of total tenant count.

export async function findRecentlyRegisteredUnnotified() {
  const [rows] = await pool.query(`
    SELECT t.* FROM tenants t
    WHERE t.created_at >= NOW() - INTERVAL 48 HOUR
      AND NOT EXISTS (
        SELECT 1 FROM platform_notifications pn
        WHERE pn.tenant_id = t.id AND pn.category = 'tenant_registered'
      )
  `);
  return rows;
}

export async function findTrialsExpiringSoonUnnotified(withinDays = 3) {
  const [rows] = await pool.query(
    `SELECT t.* FROM tenants t
     WHERE t.subscription_status = 'trial'
       AND t.trial_ends_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
       AND NOT EXISTS (
         SELECT 1 FROM platform_notifications pn
         WHERE pn.tenant_id = t.id AND pn.category = 'trial_expiring' AND pn.created_at > t.trial_started_at
       )`,
    [withinDays],
  );
  return rows;
}

export async function findExpiredUnnotified() {
  const [rows] = await pool.query(`
    SELECT t.* FROM tenants t
    WHERE t.subscription_status = 'expired'
      AND NOT EXISTS (
        SELECT 1 FROM platform_notifications pn
        WHERE pn.tenant_id = t.id AND pn.category = 'trial_expired' AND pn.created_at > t.trial_started_at
      )
  `);
  return rows;
}
