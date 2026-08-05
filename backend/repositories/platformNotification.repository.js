import { pool } from '../config/db.js';

// Fan-out on write, mirroring notification.repository.js's
// notifyBranchManagement() pattern — one row per active platform admin, so
// per-admin read-state is always unambiguous.
export async function fanOutToAllAdmins({ type = 'info', category, title, message, tenantId }) {
  await pool.query(
    `INSERT INTO platform_notifications (platform_admin_id, type, category, title, message, tenant_id)
     SELECT id, ?, ?, ?, ?, ? FROM platform_admins WHERE status = 'active'`,
    [type, category, title, message || null, tenantId || null],
  );
}

export async function findAllForAdmin({ platformAdminId, page = 1, limit = 20, status }) {
  const conditions = ['platform_admin_id = ?'];
  const params = [platformAdminId];

  if (status === 'unread') conditions.push('read_at IS NULL');
  else if (status === 'read') conditions.push('read_at IS NOT NULL');

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT pn.*, t.company_name AS tenant_name FROM platform_notifications pn
     LEFT JOIN tenants t ON t.id = pn.tenant_id
     ${whereClause} ORDER BY pn.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM platform_notifications pn ${whereClause}`, params);

  return { rows, total };
}

export async function getUnreadCount(platformAdminId) {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM platform_notifications WHERE platform_admin_id = ? AND read_at IS NULL',
    [platformAdminId],
  );
  return Number(count);
}

export async function markRead(id, platformAdminId) {
  const [result] = await pool.query(
    'UPDATE platform_notifications SET read_at = NOW() WHERE id = ? AND platform_admin_id = ? AND read_at IS NULL',
    [id, platformAdminId],
  );
  return result.affectedRows > 0;
}

export async function markAllRead(platformAdminId) {
  await pool.query(
    'UPDATE platform_notifications SET read_at = NOW() WHERE platform_admin_id = ? AND read_at IS NULL',
    [platformAdminId],
  );
}
