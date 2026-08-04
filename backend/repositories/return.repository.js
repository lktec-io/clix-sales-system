import { pool } from '../config/db.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    `SELECT r.*, s.sale_number, s.branch_id, b.name AS branch_name,
            c.first_name AS customer_first_name, c.last_name AS customer_last_name,
            cu.first_name AS created_by_first_name, cu.last_name AS created_by_last_name,
            au.first_name AS approved_by_first_name, au.last_name AS approved_by_last_name
     FROM returns r
     JOIN sales s ON s.id = r.sale_id
     JOIN branches b ON b.id = s.branch_id
     LEFT JOIN customers c ON c.id = r.customer_id
     LEFT JOIN users cu ON cu.id = r.created_by
     LEFT JOIN users au ON au.id = r.approved_by
     WHERE r.id = ? AND r.tenant_id = ? LIMIT 1`,
    [id, tenantId],
  );
  if (!rows[0]) return null;

  // LEFT JOIN + COALESCE onto sale_items' own *_snapshot columns (see the
  // 015 migration) — the returned product can be permanently deleted after
  // the return itself was recorded; this must still show what was
  // returned.
  const [items] = await pool.query(
    `SELECT ri.*, si.product_id, si.quantity AS sold_quantity, si.unit_price,
            COALESCE(p.name, si.product_name_snapshot) AS product_name,
            COALESCE(p.code, si.product_code_snapshot) AS product_code
     FROM return_items ri
     JOIN sale_items si ON si.id = ri.sale_item_id
     LEFT JOIN products p ON p.id = si.product_id
     WHERE ri.return_id = ?`,
    [id],
  );
  return { ...rows[0], items };
}

function branchFilter(branchIds) {
  if (!branchIds) return { clause: '', params: [] };
  if (branchIds.length === 0) return { clause: 'AND 1 = 0', params: [] };
  return { clause: 'AND s.branch_id IN (?)', params: [branchIds] };
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status, branchIds }) {
  const conditions = ['r.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(r.return_number LIKE ? OR s.sale_number LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }

  const scope = branchFilter(branchIds);
  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const offset = (page - 1) * limit;
  const allParams = [...params, ...scope.params];

  const [rows] = await pool.query(
    `SELECT r.*, s.sale_number, s.branch_id, b.name AS branch_name,
            c.first_name AS customer_first_name, c.last_name AS customer_last_name
     FROM returns r
     JOIN sales s ON s.id = r.sale_id
     JOIN branches b ON b.id = s.branch_id
     LEFT JOIN customers c ON c.id = r.customer_id
     ${whereClause}
     ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM returns r JOIN sales s ON s.id = r.sale_id ${whereClause}`,
    allParams,
  );

  return { rows, total: countRows[0].total };
}

export async function createRequest(
  { tenantId, returnNumber, saleId, customerId, reason, refundAmount, refundMethod, createdBy },
  connection,
) {
  const [result] = await connection.query(
    `INSERT INTO returns (tenant_id, return_number, sale_id, customer_id, reason, status, refund_amount, refund_method, refund_status, created_by)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 'pending', ?)`,
    [tenantId, returnNumber, saleId, customerId || null, reason, refundAmount, refundMethod, createdBy],
  );
  return result.insertId;
}

export async function createItem({ returnId, saleItemId, quantity }, connection) {
  await connection.query(
    'INSERT INTO return_items (return_id, sale_item_id, quantity) VALUES (?, ?, ?)',
    [returnId, saleItemId, quantity],
  );
}

// Sums quantity already claimed by non-rejected return requests against one
// sale line, so a second (or third) return against the same sale can't push
// the total past what was actually sold.
export async function getReturnedQuantity(saleItemId) {
  const [[{ total }]] = await pool.query(
    `SELECT COALESCE(SUM(ri.quantity), 0) AS total
     FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE ri.sale_item_id = ? AND r.status != 'rejected'`,
    [saleItemId],
  );
  return Number(total);
}

// Guards against double-processing the same way Transfers does. refundStatus
// is only touched when the caller supplies one (approval sets 'refunded';
// rejection passes nothing and leaves it as-is, since a rejected return
// never had a refund to track).
export async function setStatus({ id, status, approvedBy, refundStatus }, connection = pool) {
  const [result] = await connection.query(
    `UPDATE returns SET status = ?, approved_by = ?, approved_at = NOW(), refund_status = COALESCE(?, refund_status)
     WHERE id = ? AND status = 'pending'`,
    [status, approvedBy, refundStatus || null, id],
  );
  return result.affectedRows > 0;
}
