import { pool } from '../config/db.js';

const LIST_SELECT = `
  SELECT mi.*, c.name AS category_name
  FROM menu_items mi
  LEFT JOIN categories c ON c.id = mi.category_id
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${LIST_SELECT} WHERE mi.id = ? AND mi.tenant_id = ? AND mi.deleted_at IS NULL LIMIT 1`, [id, tenantId]);
  return rows[0] || null;
}

// The order-builder picker — only ever needs available, non-deleted items.
export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    `${LIST_SELECT} WHERE mi.tenant_id = ? AND mi.is_available = TRUE AND mi.deleted_at IS NULL ORDER BY mi.name`,
    [tenantId],
  );
  return rows;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, categoryId, isAvailable }) {
  const conditions = ['mi.deleted_at IS NULL', 'mi.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('mi.name LIKE ?');
    params.push(`%${search}%`);
  }
  if (categoryId) {
    conditions.push('mi.category_id = ?');
    params.push(categoryId);
  }
  if (isAvailable !== undefined) {
    conditions.push('mi.is_available = ?');
    params.push(isAvailable ? 1 : 0);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${LIST_SELECT} ${whereClause} ORDER BY mi.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM menu_items mi ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, categoryId, name, sellingPrice, description, imageUrl, isAvailable, userId }) {
  const [result] = await pool.query(
    `INSERT INTO menu_items (tenant_id, category_id, name, selling_price, description, image_url, is_available, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, categoryId || null, name, sellingPrice, description || null, imageUrl || null, isAvailable !== false, userId, userId],
  );
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { categoryId, name, sellingPrice, description, imageUrl, isAvailable, userId }) {
  await pool.query(
    `UPDATE menu_items SET category_id = ?, name = ?, selling_price = ?, description = ?, image_url = ?, is_available = ?, updated_by = ?
     WHERE id = ? AND tenant_id = ?`,
    [categoryId || null, name, sellingPrice, description || null, imageUrl || null, isAvailable !== false, userId, id, tenantId],
  );
  return findById(id, tenantId);
}

export async function softDelete(id, tenantId) {
  await pool.query('UPDATE menu_items SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}
