import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

const DETAIL_SELECT = `
  SELECT p.*, s.name AS supplier_name, b.name AS branch_name
  FROM pharmacy_purchases p
  JOIN suppliers s ON s.id = p.supplier_id
  JOIN branches b ON b.id = p.branch_id
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE p.id = ? AND p.tenant_id = ? LIMIT 1`, [id, tenantId]);
  if (!rows[0]) return null;
  const [items] = await pool.query(
    `SELECT pi.*, m.name AS medicine_name, mb.batch_number, mb.expiry_date
     FROM pharmacy_purchase_items pi
     JOIN medicines m ON m.id = pi.medicine_id
     JOIN medicine_batches mb ON mb.id = pi.batch_id
     WHERE pi.purchase_id = ?`,
    [id],
  );
  return { ...rows[0], items };
}

export async function findAll({ tenantId, page = 1, limit = 20, search, branchIds }) {
  const scope = buildScope({ tenantId, tenantColumn: 'p.tenant_id', branchIds, branchColumn: 'p.branch_id' });
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    conditions.push('(p.purchase_number LIKE ? OR s.name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${DETAIL_SELECT} ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM pharmacy_purchases p JOIN suppliers s ON s.id = p.supplier_id ${whereClause}`,
    allParams,
  );

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, branchId, supplierId, purchaseNumber, reference, purchaseDate, totalAmount, createdBy }, connection) {
  const [result] = await connection.query(
    `INSERT INTO pharmacy_purchases (tenant_id, branch_id, supplier_id, purchase_number, reference, purchase_date, total_amount, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, branchId, supplierId, purchaseNumber, reference || null, purchaseDate, totalAmount, createdBy],
  );
  return result.insertId;
}

export async function createItem({ purchaseId, medicineId, batchId, quantity, buyingPrice, lineTotal }, connection) {
  await connection.query(
    'INSERT INTO pharmacy_purchase_items (purchase_id, medicine_id, batch_id, quantity, buying_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
    [purchaseId, medicineId, batchId, quantity, buyingPrice, lineTotal],
  );
}
