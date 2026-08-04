import { pool } from '../config/db.js';

export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name FROM expense_categories WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name',
    [tenantId],
  );
  return rows;
}

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    'SELECT * FROM expense_categories WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function findByName(name, tenantId) {
  const [rows] = await pool.query(
    'SELECT id FROM expense_categories WHERE name = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
    [name, tenantId],
  );
  return rows[0] || null;
}

export async function findAll({ tenantId, page = 1, limit = 20, search }) {
  const conditions = ['deleted_at IS NULL', 'tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('name LIKE ?');
    params.push(`%${search}%`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM expense_categories ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM expense_categories ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, name }) {
  const [result] = await pool.query('INSERT INTO expense_categories (tenant_id, name) VALUES (?, ?)', [tenantId, name]);
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { name }) {
  await pool.query('UPDATE expense_categories SET name = ? WHERE id = ? AND tenant_id = ?', [name, id, tenantId]);
  return findById(id, tenantId);
}

export async function softDelete(id, tenantId) {
  await pool.query('UPDATE expense_categories SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

export async function countExpenses(id, tenantId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM expenses WHERE expense_category_id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  return rows[0].total;
}
