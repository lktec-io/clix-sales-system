import { pool } from '../config/db.js';

const BASE_SELECT = `
  SELECT b.*, m.first_name AS manager_first_name, m.last_name AS manager_last_name
  FROM branches b
  LEFT JOIN users m ON m.id = b.manager_id
`;

export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    "SELECT id, name, code FROM branches WHERE tenant_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY name",
    [tenantId],
  );
  return rows;
}

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE b.id = ? AND b.tenant_id = ? AND b.deleted_at IS NULL LIMIT 1`, [id, tenantId]);
  return rows[0] || null;
}

export async function findByCode(code, tenantId) {
  const [rows] = await pool.query('SELECT id, code FROM branches WHERE code = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [code, tenantId]);
  return rows[0] || null;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status }) {
  const conditions = ['b.deleted_at IS NULL', 'b.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(b.name LIKE ? OR b.code LIKE ? OR b.region LIKE ? OR b.district LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (status) {
    conditions.push('b.status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${BASE_SELECT} ${whereClause} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM branches b ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO branches (tenant_id, name, code, manager_id, phone, email, address, region, district, opening_date, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tenantId, data.name, data.code, data.managerId || null, data.phone || null, data.email || null,
      data.address || null, data.region || null, data.district || null, data.openingDate || null,
      data.status || 'active', data.userId, data.userId,
    ],
  );
  return findById(result.insertId, data.tenantId);
}

export async function update(id, tenantId, data) {
  await pool.query(
    `UPDATE branches SET name = ?, code = ?, manager_id = ?, phone = ?, email = ?, address = ?,
       region = ?, district = ?, opening_date = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`,
    [
      data.name, data.code, data.managerId || null, data.phone || null, data.email || null,
      data.address || null, data.region || null, data.district || null, data.openingDate || null,
      data.userId, id, tenantId,
    ],
  );
  return findById(id, tenantId);
}

export async function updateStatus(id, tenantId, status, userId) {
  await pool.query('UPDATE branches SET status = ?, updated_by = ? WHERE id = ? AND tenant_id = ?', [status, userId, id, tenantId]);
  return findById(id, tenantId);
}

export async function countUsersAssigned(id, tenantId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM users WHERE branch_id = ? AND tenant_id = ? AND deleted_at IS NULL',
    [id, tenantId],
  );
  return rows[0].total;
}
