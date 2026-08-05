import { pool } from '../config/db.js';

export async function create({ platformAdminId, action, description, tenantId, ipAddress }) {
  await pool.query(
    'INSERT INTO platform_audit_logs (platform_admin_id, action, description, tenant_id, ip_address) VALUES (?, ?, ?, ?, ?)',
    [platformAdminId || null, action, description, tenantId || null, ipAddress || null],
  );
}

export async function findAll({ page = 1, limit = 20, tenantId, adminId, action }) {
  const conditions = ['1 = 1'];
  const params = [];

  if (tenantId) {
    conditions.push('tenant_id = ?');
    params.push(tenantId);
  }
  if (adminId) {
    conditions.push('platform_admin_id = ?');
    params.push(adminId);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT pal.*, pa.first_name AS admin_first_name, pa.last_name AS admin_last_name, t.company_name AS tenant_name
     FROM platform_audit_logs pal
     LEFT JOIN platform_admins pa ON pa.id = pal.platform_admin_id
     LEFT JOIN tenants t ON t.id = pal.tenant_id
     ${whereClause}
     ORDER BY pal.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM platform_audit_logs pal ${whereClause}`, params);

  return { rows, total };
}

// Backs the platform dashboard's "Recent Activity" widget.
export async function findRecent(limit = 20) {
  const [rows] = await pool.query(
    `SELECT pal.id, pal.action, pal.description, pal.created_at, pal.tenant_id,
            pa.first_name AS admin_first_name, pa.last_name AS admin_last_name,
            t.company_name AS tenant_name
     FROM platform_audit_logs pal
     LEFT JOIN platform_admins pa ON pa.id = pal.platform_admin_id
     LEFT JOIN tenants t ON t.id = pal.tenant_id
     ORDER BY pal.created_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows;
}
