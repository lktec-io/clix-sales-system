import { pool } from '../config/db.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [id, tenantId]);
  return rows[0] || null;
}

// Case-insensitive exact match, used by the Purchases Excel import to
// resolve a template row's "Supplier" text column to a real supplier — an
// unmatched name is reported to the importer as "Unknown supplier" rather
// than silently creating one, since suppliers (unlike products/categories)
// aren't auto-created by this import per the sprint spec.
export async function findByName(name, tenantId) {
  const [rows] = await pool.query(
    'SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?) AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
    [name, tenantId],
  );
  return rows[0] || null;
}

export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    "SELECT id, name FROM suppliers WHERE tenant_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY name",
    [tenantId],
  );
  return rows;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status }) {
  const conditions = ['deleted_at IS NULL', 'tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM suppliers ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM suppliers ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, name, phone, email, address, notes, tinNumber, status, userId }) {
  const [result] = await pool.query(
    'INSERT INTO suppliers (tenant_id, name, phone, email, address, notes, tin_number, status, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [tenantId, name, phone || null, email || null, address || null, notes || null, tinNumber || null, status || 'active', userId, userId],
  );
  return findById(result.insertId, tenantId);
}

// status is NOT NULL with a DB default, but this UPDATE (unlike create())
// has no fallback — the simplified supplier form no longer sends status at
// all. COALESCE(?, status) preserves the existing value instead of writing
// NULL into a NOT NULL column.
export async function update(id, tenantId, { name, phone, email, address, notes, tinNumber, status, userId }) {
  await pool.query(
    'UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, tin_number = ?, status = COALESCE(?, status), updated_by = ? WHERE id = ? AND tenant_id = ?',
    [name, phone || null, email || null, address || null, notes || null, tinNumber || null, status || null, userId, id, tenantId],
  );
  return findById(id, tenantId);
}

export async function updateStatus(id, tenantId, status, userId) {
  await pool.query('UPDATE suppliers SET status = ?, updated_by = ? WHERE id = ? AND tenant_id = ?', [status, userId, id, tenantId]);
  return findById(id, tenantId);
}

// A real DELETE. Unlike customers, purchase_orders.supplier_id and
// supplier_payments.supplier_id are both ON DELETE RESTRICT (see
// 005_create_purchases_suppliers.sql) — deleting a supplier with any
// purchase history throws ER_ROW_IS_REFERENCED_2, which the service layer
// converts into a clear 409 instead of a raw SQL error.
export async function hardDelete(id, tenantId) {
  const [result] = await pool.query('DELETE FROM suppliers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  return result.affectedRows > 0;
}

export async function findPurchaseHistory(supplierId, tenantId, { page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT id, purchase_number, branch_id, total_amount, status, created_at
     FROM purchase_orders WHERE supplier_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [supplierId, tenantId, limit, offset],
  );
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM purchase_orders WHERE supplier_id = ? AND tenant_id = ?', [supplierId, tenantId]);
  return { rows, total };
}

export async function getBalance(supplierId, tenantId) {
  const [[{ totalPurchased }]] = await pool.query(
    "SELECT COALESCE(SUM(total_amount), 0) AS totalPurchased FROM purchase_orders WHERE supplier_id = ? AND tenant_id = ? AND status != 'cancelled'",
    [supplierId, tenantId],
  );
  const [[{ totalPaid }]] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS totalPaid FROM supplier_payments WHERE supplier_id = ?',
    [supplierId],
  );
  return {
    totalPurchased: Number(totalPurchased),
    totalPaid: Number(totalPaid),
    outstandingBalance: Number(totalPurchased) - Number(totalPaid),
  };
}
