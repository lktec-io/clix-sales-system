import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    `SELECT po.*, s.name AS supplier_name, b.name AS branch_name
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     JOIN branches b ON b.id = po.branch_id
     WHERE po.id = ? AND po.tenant_id = ? LIMIT 1`,
    [id, tenantId],
  );
  if (!rows[0]) return null;

  // LEFT JOIN + COALESCE onto the *_snapshot columns (see the 015
  // migration) — a product can be permanently deleted after being
  // purchased; product_id goes NULL, but this purchase order must still
  // display what was actually bought.
  const [items] = await pool.query(
    `SELECT pi.*,
            COALESCE(p.name, pi.product_name_snapshot) AS product_name,
            COALESCE(p.code, pi.product_code_snapshot) AS product_code
     FROM purchase_items pi LEFT JOIN products p ON p.id = pi.product_id
     WHERE pi.purchase_order_id = ?`,
    [id],
  );
  return { ...rows[0], items };
}

export async function findAll({ tenantId, page = 1, limit = 20, search, supplierId, branchId, status, branchIds }) {
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    conditions.push('po.purchase_number LIKE ?');
    params.push(`%${search}%`);
  }
  if (supplierId) {
    conditions.push('po.supplier_id = ?');
    params.push(supplierId);
  }
  if (branchId) {
    conditions.push('po.branch_id = ?');
    params.push(branchId);
  }
  if (status) {
    conditions.push('po.status = ?');
    params.push(status);
  }

  const scope = buildScope({ tenantId, tenantColumn: 'po.tenant_id', branchIds, branchColumn: 'po.branch_id' });
  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const offset = (page - 1) * limit;
  const allParams = [...params, ...scope.params];

  const [rows] = await pool.query(
    `SELECT po.*, s.name AS supplier_name, b.name AS branch_name
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     JOIN branches b ON b.id = po.branch_id
     ${whereClause}
     ORDER BY po.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM purchase_orders po ${whereClause}`, allParams);

  return { rows, total: countRows[0].total };
}

export async function createOrder({ tenantId, purchaseNumber, supplierId, branchId, totalAmount, userId }, connection) {
  const [result] = await connection.query(
    `INSERT INTO purchase_orders (tenant_id, purchase_number, supplier_id, branch_id, total_amount, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, 'received', ?, ?)`,
    [tenantId, purchaseNumber, supplierId, branchId, totalAmount, userId, userId],
  );
  return result.insertId;
}

export async function createItem({ purchaseOrderId, productId, quantity, buyingPrice, lineTotal }, connection) {
  await connection.query(
    'INSERT INTO purchase_items (purchase_order_id, product_id, quantity, buying_price, line_total) VALUES (?, ?, ?, ?, ?)',
    [purchaseOrderId, productId, quantity, buyingPrice, lineTotal],
  );
}

export async function addPayment({ supplierId, purchaseOrderId, amount, paymentMethod, paidAt, userId }) {
  const [result] = await pool.query(
    `INSERT INTO supplier_payments (supplier_id, purchase_order_id, amount, payment_method, paid_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [supplierId, purchaseOrderId || null, amount, paymentMethod, paidAt, userId],
  );
  return result.insertId;
}
