import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    `SELECT b.*, m.name AS medicine_name FROM medicine_batches b JOIN medicines m ON m.id = b.medicine_id
     WHERE b.id = ? AND b.tenant_id = ? LIMIT 1`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function findByMedicine(medicineId, tenantId) {
  const [rows] = await pool.query(
    'SELECT * FROM medicine_batches WHERE medicine_id = ? AND tenant_id = ? ORDER BY expiry_date ASC',
    [medicineId, tenantId],
  );
  return rows;
}

// FEFO — First-Expire-First-Out. Only batches with stock remaining and not
// yet expired are eligible; ordering by expiry_date ASC means the soonest-
// to-expire non-expired batch is always sold first. FOR UPDATE locks these
// rows for the life of the enclosing transaction so two concurrent sales
// can never both read the same "quantity remaining" and oversell it.
export async function findSellableBatchesForUpdate(medicineId, branchId, tenantId, connection) {
  const [rows] = await connection.query(
    `SELECT * FROM medicine_batches
     WHERE medicine_id = ? AND branch_id = ? AND tenant_id = ? AND quantity > 0 AND expiry_date >= CURDATE()
     ORDER BY expiry_date ASC
     FOR UPDATE`,
    [medicineId, branchId, tenantId],
  );
  return rows;
}

export async function create({
  tenantId, medicineId, branchId, supplierId, batchNumber, buyingPrice, sellingPrice, quantity, expiryDate, receivedDate,
}, connection) {
  const [result] = await connection.query(
    `INSERT INTO medicine_batches (tenant_id, medicine_id, branch_id, supplier_id, batch_number, buying_price, selling_price, quantity, expiry_date, received_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, medicineId, branchId, supplierId || null, batchNumber, buyingPrice, sellingPrice || null, quantity, expiryDate, receivedDate || new Date()],
  );
  return result.insertId;
}

export async function decrementQuantity(id, amount, connection) {
  await connection.query('UPDATE medicine_batches SET quantity = quantity - ? WHERE id = ?', [amount, id]);
}

// Topping up an existing batch on a repeat delivery (same medicine, branch,
// batch_number) — kept as its own function rather than reusing
// decrementQuantity() with a negative amount, which would work
// arithmetically but read backwards at the call site.
export async function incrementQuantity(id, amount, connection) {
  await connection.query('UPDATE medicine_batches SET quantity = quantity + ? WHERE id = ?', [amount, id]);
}

export async function findExpiring({ tenantId, branchIds, status, page = 1, limit = 20 }) {
  const scope = buildScope({ tenantId, tenantColumn: 'b.tenant_id', branchIds, branchColumn: 'b.branch_id' });
  const conditions = ['b.quantity > 0'];
  const params = [];

  // 'expired': already past expiry. 'expiring_soon': within the next 30
  // days. 'valid': everything else. No status filter -> every batch that
  // still has stock, regardless of expiry state.
  if (status === 'expired') conditions.push('b.expiry_date < CURDATE()');
  else if (status === 'expiring_soon') conditions.push('b.expiry_date >= CURDATE() AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
  else if (status === 'valid') conditions.push('b.expiry_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY)');

  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT b.*, m.name AS medicine_name, br.name AS branch_name
     FROM medicine_batches b
     JOIN medicines m ON m.id = b.medicine_id
     JOIN branches br ON br.id = b.branch_id
     ${whereClause} ORDER BY b.expiry_date ASC LIMIT ? OFFSET ?`,
    [...params, ...scope.params, limit, offset],
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM medicine_batches b ${whereClause}`,
    [...params, ...scope.params],
  );

  return { rows, total: countRows[0].total };
}

export async function getExpirySummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'tenant_id', branchIds, branchColumn: 'branch_id' });
  const [[row]] = await pool.query(
    `SELECT
       COUNT(CASE WHEN expiry_date < CURDATE() THEN 1 END) AS expiredCount,
       COUNT(CASE WHEN expiry_date >= CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 END) AS expiringSoonCount
     FROM medicine_batches WHERE quantity > 0 ${scope.clause}`,
    scope.params,
  );
  return { expiredCount: Number(row.expiredCount), expiringSoonCount: Number(row.expiringSoonCount) };
}
