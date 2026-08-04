import { pool } from '../config/db.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query('SELECT * FROM categories WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [id, tenantId]);
  return rows[0] || null;
}

export async function findByName(name, tenantId) {
  const [rows] = await pool.query('SELECT id, name FROM categories WHERE name = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [name, tenantId]);
  return rows[0] || null;
}

// Case-insensitive exact match — the Purchases Excel import resolves a
// template row's "Category" text column against this before deciding
// whether to reuse an existing category or auto-create a new one.
export async function findByNameCaseInsensitive(name, tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name, code FROM categories WHERE LOWER(name) = LOWER(?) AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
    [name, tenantId],
  );
  return rows[0] || null;
}

export async function findByCode(code, tenantId) {
  const [rows] = await pool.query('SELECT id, code FROM categories WHERE code = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [code, tenantId]);
  return rows[0] || null;
}

export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    "SELECT id, name, code FROM categories WHERE tenant_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY name",
    [tenantId],
  );
  return rows;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status }) {
  const conditions = ['deleted_at IS NULL', 'tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(name LIKE ? OR code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM categories ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM categories ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, name, code, description, status, userId }) {
  const [result] = await pool.query(
    'INSERT INTO categories (tenant_id, name, code, description, status, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [tenantId, name, code, description || null, status || 'active', userId, userId],
  );
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { name, code, description, status, userId }) {
  await pool.query(
    'UPDATE categories SET name = ?, code = ?, description = ?, status = ?, updated_by = ? WHERE id = ? AND tenant_id = ?',
    [name, code, description || null, status, userId, id, tenantId],
  );
  return findById(id, tenantId);
}

export async function softDelete(id, tenantId, userId) {
  await pool.query('UPDATE categories SET deleted_at = NOW(), updated_by = ? WHERE id = ? AND tenant_id = ?', [userId, id, tenantId]);
}

export async function countProducts(id, tenantId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND tenant_id = ? AND deleted_at IS NULL',
    [id, tenantId],
  );
  return rows[0].total;
}
