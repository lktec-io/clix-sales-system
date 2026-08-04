import { pool } from '../config/db.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    `SELECT t.*, sb.name AS source_branch_name, db.name AS destination_branch_name,
            ru.first_name AS requested_by_first_name, ru.last_name AS requested_by_last_name,
            au.first_name AS approved_by_first_name, au.last_name AS approved_by_last_name
     FROM stock_transfer_requests t
     JOIN branches sb ON sb.id = t.source_branch_id
     JOIN branches db ON db.id = t.destination_branch_id
     JOIN users ru ON ru.id = t.requested_by
     LEFT JOIN users au ON au.id = t.approved_by
     WHERE t.id = ? AND t.tenant_id = ? LIMIT 1`,
    [id, tenantId],
  );
  if (!rows[0]) return null;

  const [items] = await pool.query(
    `SELECT ti.*, p.name AS product_name, p.code AS product_code
     FROM stock_transfer_items ti JOIN products p ON p.id = ti.product_id
     WHERE ti.transfer_id = ?`,
    [id],
  );
  return { ...rows[0], items };
}

function branchFilter(branchIds) {
  if (!branchIds) return { clause: '', params: [] };
  if (branchIds.length === 0) return { clause: 'AND 1 = 0', params: [] };
  return { clause: 'AND (t.source_branch_id IN (?) OR t.destination_branch_id IN (?))', params: [branchIds, branchIds] };
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status, branchId, branchIds }) {
  const conditions = ['t.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('t.transfer_number LIKE ?');
    params.push(`%${search}%`);
  }
  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }
  if (branchId) {
    conditions.push('(t.source_branch_id = ? OR t.destination_branch_id = ?)');
    params.push(branchId, branchId);
  }

  const scope = branchFilter(branchIds);
  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const offset = (page - 1) * limit;
  const allParams = [...params, ...scope.params];

  const [rows] = await pool.query(
    `SELECT t.*, sb.name AS source_branch_name, db.name AS destination_branch_name,
            ru.first_name AS requested_by_first_name, ru.last_name AS requested_by_last_name
     FROM stock_transfer_requests t
     JOIN branches sb ON sb.id = t.source_branch_id
     JOIN branches db ON db.id = t.destination_branch_id
     JOIN users ru ON ru.id = t.requested_by
     ${whereClause}
     ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM stock_transfer_requests t ${whereClause}`, allParams);

  return { rows, total: countRows[0].total };
}

export async function createRequest({ tenantId, transferNumber, sourceBranchId, destinationBranchId, requestedBy }, connection) {
  const [result] = await connection.query(
    `INSERT INTO stock_transfer_requests (tenant_id, transfer_number, source_branch_id, destination_branch_id, status, requested_by)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [tenantId, transferNumber, sourceBranchId, destinationBranchId, requestedBy],
  );
  return result.insertId;
}

export async function createItem({ transferId, productId, quantity }, connection) {
  await connection.query(
    'INSERT INTO stock_transfer_items (transfer_id, product_id, quantity) VALUES (?, ?, ?)',
    [transferId, productId, quantity],
  );
}

// Guards against double-processing: only flips a still-pending transfer, so
// two concurrent approve/reject requests can't both succeed.
export async function setStatus({ id, status, approvedBy }, connection = pool) {
  const [result] = await connection.query(
    `UPDATE stock_transfer_requests SET status = ?, approved_by = ?, approved_at = NOW()
     WHERE id = ? AND status = 'pending'`,
    [status, approvedBy, id],
  );
  return result.affectedRows > 0;
}
