import { pool } from '../config/db.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query('SELECT * FROM brands WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [id, tenantId]);
  return rows[0] || null;
}

export async function findByName(name, tenantId) {
  const [rows] = await pool.query('SELECT id, name FROM brands WHERE name = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [name, tenantId]);
  return rows[0] || null;
}

export async function findByCode(code, tenantId) {
  const [rows] = await pool.query('SELECT id, code FROM brands WHERE code = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [code, tenantId]);
  return rows[0] || null;
}

export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    "SELECT id, name, code FROM brands WHERE tenant_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY name",
    [tenantId],
  );
  return rows;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status }) {
  const conditions = ['deleted_at IS NULL', 'tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(name LIKE ? OR code LIKE ? OR country LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM brands ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM brands ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, name, code, description, country, status, userId }) {
  const [result] = await pool.query(
    'INSERT INTO brands (tenant_id, name, code, description, country, status, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [tenantId, name, code, description || null, country || null, status || 'active', userId, userId],
  );
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { name, code, description, country, status, userId }) {
  await pool.query(
    'UPDATE brands SET name = ?, code = ?, description = ?, country = ?, status = ?, updated_by = ? WHERE id = ? AND tenant_id = ?',
    [name, code, description || null, country || null, status, userId, id, tenantId],
  );
  return findById(id, tenantId);
}

export async function softDelete(id, tenantId, userId) {
  await pool.query('UPDATE brands SET deleted_at = NOW(), updated_by = ? WHERE id = ? AND tenant_id = ?', [userId, id, tenantId]);
}

export async function countProducts(id, tenantId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM products WHERE brand_id = ? AND tenant_id = ? AND deleted_at IS NULL',
    [id, tenantId],
  );
  return rows[0].total;
}
