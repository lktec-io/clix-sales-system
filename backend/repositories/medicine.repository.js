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

// Powers the Pharmacy POS's search-and-add grid — mirrors
// product.repository.js#findSellable exactly, except availability is a
// branch-scoped, non-expired SUM across medicine_batches (there is no
// separate `inventory` row per medicine the way products have one).
// Excluding expired batches here matches sellMedicines()'s own FEFO
// allocation, which never dispenses from an expired batch either — so a
// medicine the POS shows as "in stock" is always actually sellable.
export async function findSellable({ tenantId, branchId, search, categoryId, limit = 60 }) {
  const conditions = ["m.deleted_at IS NULL", "m.status = 'active'", 'm.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(m.name LIKE ? OR m.barcode = ?)');
    params.push(`%${search}%`, search);
  }
  if (categoryId) {
    conditions.push('m.category_id = ?');
    params.push(categoryId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await pool.query(
    `SELECT m.id, m.name, m.barcode, m.unit, m.selling_price, m.category_id, c.name AS category_name,
            COALESCE((SELECT SUM(b.quantity) FROM medicine_batches b WHERE b.medicine_id = m.id AND b.branch_id = ? AND b.expiry_date >= CURDATE()), 0) AS available_quantity
     FROM medicines m
     LEFT JOIN categories c ON c.id = m.category_id
     ${whereClause}
     ORDER BY m.name
     LIMIT ?`,
    [branchId, ...params, limit],
  );
  return rows;
}

// Exact-match barcode lookup for a typed/scanned code — same distinction
// findSellableByCode() draws for products: `search` above is a fuzzy grid
// filter, this resolves one specific scanned/typed value with certainty.
export async function findSellableByBarcode({ tenantId, barcode, branchId }) {
  const [rows] = await pool.query(
    `SELECT m.id, m.name, m.barcode, m.unit, m.selling_price, m.category_id, c.name AS category_name,
            COALESCE((SELECT SUM(b.quantity) FROM medicine_batches b WHERE b.medicine_id = m.id AND b.branch_id = ? AND b.expiry_date >= CURDATE()), 0) AS available_quantity
     FROM medicines m
     LEFT JOIN categories c ON c.id = m.category_id
     WHERE m.deleted_at IS NULL AND m.status = 'active' AND m.barcode = ? AND m.tenant_id = ?
     LIMIT 1`,
    [branchId, barcode, tenantId],
  );
  return rows[0] || null;
}

export async function findByBarcode(barcode, tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name FROM medicines WHERE barcode = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
    [barcode, tenantId],
  );
  return rows[0] || null;
}

// Same live SUM(batches.quantity) the LIST_SELECT column and
// getStockSummary() both use, repeated here (a SELECT-list alias can't be
// referenced from WHERE) so "Low Stock"/"Out of Stock" filtering happens in
// SQL, before LIMIT/OFFSET — filtering the already-paginated `rows` in the
// frontend would silently only filter whatever page happened to load and
// mismatch Pagination's total/totalPages.
const STOCK_TOTAL_EXPR = '(SELECT COALESCE(SUM(b.quantity), 0) FROM medicine_batches b WHERE b.medicine_id = m.id)';

export async function findAll({ tenantId, page = 1, limit = 20, search, categoryId, status, stockStatus }) {
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
  if (stockStatus === 'low') {
    conditions.push(`${STOCK_TOTAL_EXPR} > 0 AND ${STOCK_TOTAL_EXPR} <= m.reorder_level`);
  } else if (stockStatus === 'out') {
    conditions.push(`${STOCK_TOTAL_EXPR} = 0`);
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

// Accepts an optional transaction `connection` so the Medicine-creation-
// with-opening-stock flow (medicine.service.js#createMedicine) can write
// this INSERT and its batch/stock-movement rows atomically. When a
// connection is supplied, a plain `{ id }` is returned instead of the full
// row — the caller reads the committed row back afterward, since a
// same-connection read-your-own-write is unnecessary complexity here and a
// different pooled connection couldn't see the uncommitted row anyway.
export async function create({ tenantId, categoryId, name, barcode, unit, sellingPrice, reorderLevel, description, status, userId }, connection) {
  const runner = connection || pool;
  const [result] = await runner.query(
    `INSERT INTO medicines (tenant_id, category_id, name, barcode, unit, selling_price, reorder_level, description, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, categoryId || null, name, barcode || null, unit || 'unit', sellingPrice, reorderLevel || 0, description || null, status || 'active', userId, userId],
  );
  if (connection) return { id: result.insertId };
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { categoryId, name, barcode, unit, sellingPrice, reorderLevel, description, status, userId }) {
  await pool.query(
    `UPDATE medicines SET category_id = ?, name = ?, barcode = ?, unit = ?, selling_price = ?, reorder_level = ?, description = ?, status = ?, updated_by = ?
     WHERE id = ? AND tenant_id = ?`,
    [categoryId || null, name, barcode || null, unit || 'unit', sellingPrice, reorderLevel || 0, description || null, status || 'active', userId, id, tenantId],
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
