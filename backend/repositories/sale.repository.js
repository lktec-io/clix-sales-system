import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

// Looked up BEFORE opening a checkout transaction — a client-resubmitted
// (double-click, retried network request) checkout carrying the same key
// as one that already succeeded returns the existing sale id instead of
// creating a second one.
export async function findByIdempotencyKey(key, tenantId) {
  if (!key) return null;
  const [rows] = await pool.query('SELECT id FROM sales WHERE idempotency_key = ? AND tenant_id = ? LIMIT 1', [key, tenantId]);
  return rows[0]?.id || null;
}

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    `SELECT s.*, b.name AS branch_name,
            c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.customer_code,
            u.first_name AS cashier_first_name, u.last_name AS cashier_last_name
     FROM sales s
     JOIN branches b ON b.id = s.branch_id
     LEFT JOIN customers c ON c.id = s.customer_id
     JOIN users u ON u.id = s.cashier_id
     WHERE s.id = ? AND s.tenant_id = ? LIMIT 1`,
    [id, tenantId],
  );
  if (!rows[0]) return null;

  // p.buying_price is CURRENT cost, not a snapshot at sale time — same
  // convention report.repository.js's profitReport() already uses for
  // COGS, kept consistent here rather than introducing a second, divergent
  // way of costing a sale. sale.service.js strips this field back out of
  // the response unless the caller has permission to see profit figures.
  // LEFT JOIN (not JOIN) + COALESCE onto the *_snapshot columns (see the
  // 015 migration): a product can be permanently deleted after being sold
  // — product_id goes NULL, but the sale must still display correctly and
  // its profit must still be computable, so the row's own snapshot of the
  // name/code/cost as they were at sale time is the fallback.
  const [items] = await pool.query(
    `SELECT si.*,
            COALESCE(p.name, si.product_name_snapshot) AS product_name,
            COALESCE(p.code, si.product_code_snapshot) AS product_code,
            COALESCE(p.buying_price, si.buying_price_snapshot) AS buying_price
     FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = ?`,
    [id],
  );
  const [payments] = await pool.query('SELECT * FROM sale_payments WHERE sale_id = ?', [id]);

  return { ...rows[0], items, payments };
}

export async function findAll({ tenantId, page = 1, limit = 20, search, branchId, customerId, status, branchIds }) {
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    // Returns' "search by Receipt Number OR Barcode OR Product Name" needs
    // a sale search that matches on more than sale_number — this system
    // has no separate barcode column (products.code IS the barcode/SKU,
    // the same field the QR scanner already matches against), so Barcode
    // and Product Name both resolve to this one EXISTS check against that
    // sale's line items.
    conditions.push(`(s.sale_number LIKE ? OR EXISTS (
      SELECT 1 FROM sale_items si JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = s.id AND (p.name LIKE ? OR p.code LIKE ?)
    ))`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (branchId) {
    conditions.push('s.branch_id = ?');
    params.push(branchId);
  }
  if (customerId) {
    conditions.push('s.customer_id = ?');
    params.push(customerId);
  }
  if (status) {
    conditions.push('s.status = ?');
    params.push(status);
  }

  const scope = buildScope({ tenantId, tenantColumn: 's.tenant_id', branchIds, branchColumn: 's.branch_id' });
  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const offset = (page - 1) * limit;
  const allParams = [...params, ...scope.params];

  const [rows] = await pool.query(
    `SELECT s.*, b.name AS branch_name,
            c.first_name AS customer_first_name, c.last_name AS customer_last_name,
            u.first_name AS cashier_first_name, u.last_name AS cashier_last_name
     FROM sales s
     JOIN branches b ON b.id = s.branch_id
     LEFT JOIN customers c ON c.id = s.customer_id
     JOIN users u ON u.id = s.cashier_id
     ${whereClause}
     ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM sales s ${whereClause}`, allParams);

  return { rows, total: countRows[0].total };
}

export async function createSale(
  { tenantId, saleNumber, idempotencyKey, branchId, customerId, cashierId, subtotal, discountAmount, taxAmount, totalAmount, notes },
  connection,
) {
  const [result] = await connection.query(
    `INSERT INTO sales (tenant_id, sale_number, idempotency_key, branch_id, customer_id, cashier_id, subtotal, discount_amount, tax_amount, total_amount, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
    [tenantId, saleNumber, idempotencyKey || null, branchId, customerId || null, cashierId, subtotal, discountAmount, taxAmount, totalAmount, notes || null],
  );
  return result.insertId;
}

export async function createItem({ saleId, productId, quantity, unitPrice, discountAmount, lineTotal }, connection) {
  await connection.query(
    'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_amount, line_total) VALUES (?, ?, ?, ?, ?, ?)',
    [saleId, productId, quantity, unitPrice, discountAmount, lineTotal],
  );
}

export async function createPayment({ saleId, method, amount, referenceNumber }, connection) {
  await connection.query(
    'INSERT INTO sale_payments (sale_id, payment_method, amount, reference_number) VALUES (?, ?, ?, ?)',
    [saleId, method, amount, referenceNumber || null],
  );
}
