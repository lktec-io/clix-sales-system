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

// A true hard delete, not the app's usual soft-delete convention — safe
// here specifically because the caller (category.service.js#deleteCategory)
// already refuses to reach this unless countUsage() confirmed zero
// products/medicines/menu_items reference the category, so there is
// nothing left in the database that could be orphaned by actually removing
// the row.
export async function hardDelete(id, tenantId) {
  await pool.query('DELETE FROM categories WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

// The `categories` table is shared across every business vertical —
// Retail/Cosmetics/Electronics use it via `products`, Pharmacy via
// `medicines`, Restaurant via `menu_items` (031/033's own migration
// comments confirm this is deliberate reuse, not three separate category
// systems). A delete-safety check that only counted `products` would
// silently allow deleting a category still in active use by a Pharmacy or
// Restaurant tenant — this counts across all three so "cannot delete,
// N item(s) reference it" is accurate for every template.
export async function countUsage(id, tenantId) {
  const [[{ total: products }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND tenant_id = ? AND deleted_at IS NULL',
    [id, tenantId],
  );
  const [[{ total: medicines }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM medicines WHERE category_id = ? AND tenant_id = ? AND deleted_at IS NULL',
    [id, tenantId],
  );
  const [[{ total: menuItems }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM menu_items WHERE category_id = ? AND tenant_id = ? AND deleted_at IS NULL',
    [id, tenantId],
  );
  return products + medicines + menuItems;
}
