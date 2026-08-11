import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

// current_stock is a live SUM across batches, never a separately stored
// counter — the batches table (decremented on sale, incremented on
// purchase) is the single source of truth, so this can never drift out of
// sync the way a cached "stock" column on medicines would.
const LIST_SELECT = `
  SELECT m.*, c.name AS category_name,
         COALESCE((SELECT SUM(b.quantity) FROM medicine_batches b WHERE b.medicine_id = m.id), 0) AS current_stock
  FROM medicines m
  LEFT JOIN categories c ON c.id = m.category_id
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${LIST_SELECT} WHERE m.id = ? AND m.tenant_id = ? AND m.deleted_at IS NULL LIMIT 1`, [id, tenantId]);
  return rows[0] || null;
}

export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    "SELECT id, name, unit, selling_price FROM medicines WHERE tenant_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY name",
    [tenantId],
  );
  return rows;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, categoryId, status }) {
  const conditions = ['m.deleted_at IS NULL', 'm.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('m.name LIKE ?');
    params.push(`%${search}%`);
  }
  if (categoryId) {
    conditions.push('m.category_id = ?');
    params.push(categoryId);
  }
  if (status) {
    conditions.push('m.status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${LIST_SELECT} ${whereClause} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM medicines m ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, categoryId, name, unit, sellingPrice, reorderLevel, description, status, userId }) {
  const [result] = await pool.query(
    `INSERT INTO medicines (tenant_id, category_id, name, unit, selling_price, reorder_level, description, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, categoryId || null, name, unit || 'unit', sellingPrice, reorderLevel || 0, description || null, status || 'active', userId, userId],
  );
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { categoryId, name, unit, sellingPrice, reorderLevel, description, status, userId }) {
  await pool.query(
    `UPDATE medicines SET category_id = ?, name = ?, unit = ?, selling_price = ?, reorder_level = ?, description = ?, status = ?, updated_by = ?
     WHERE id = ? AND tenant_id = ?`,
    [categoryId || null, name, unit || 'unit', sellingPrice, reorderLevel || 0, description || null, status || 'active', userId, id, tenantId],
  );
  return findById(id, tenantId);
}

export async function softDelete(id, tenantId) {
  await pool.query('UPDATE medicines SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

// Dashboard/list "current stock" and "low stock" both need the same
// per-medicine SUM(batches.quantity) — reorder_level is compared against
// that live total, not a stored counter.
export async function getStockSummary(tenantId, branchIds) {
  const batchScope = buildScope({ tenantId, tenantColumn: 'b.tenant_id', branchIds, branchColumn: 'b.branch_id' });
  const [[row]] = await pool.query(
    `SELECT
       COUNT(*) AS totalMedicines,
       COUNT(CASE WHEN stock.total <= m.reorder_level AND stock.total > 0 THEN 1 END) AS lowStockCount,
       COUNT(CASE WHEN COALESCE(stock.total, 0) = 0 THEN 1 END) AS outOfStockCount
     FROM medicines m
     LEFT JOIN (
       SELECT b.medicine_id, SUM(b.quantity) AS total FROM medicine_batches b WHERE 1 = 1 ${batchScope.clause} GROUP BY b.medicine_id
     ) stock ON stock.medicine_id = m.id
     WHERE m.tenant_id = ? AND m.deleted_at IS NULL AND m.status = 'active'`,
    [...batchScope.params, tenantId],
  );
  return {
    totalMedicines: Number(row.totalMedicines),
    lowStockCount: Number(row.lowStockCount),
    outOfStockCount: Number(row.outOfStockCount),
  };
}
