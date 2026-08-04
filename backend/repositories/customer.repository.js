import { pool } from '../config/db.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [id, tenantId]);
  return rows[0] || null;
}

// phone carries a UNIQUE KEY (006_create_sales_pos.sql, scoped to
// (tenant_id, phone) by 019_scope_unique_keys_to_tenant.sql) — the only
// realistic conflict a customer create can hit (customer_code is generated
// by us and always unique by construction). Checked before generateCode()
// is called so a duplicate-phone attempt doesn't burn a sequence number it
// never uses.
export async function findByPhone(phone, tenantId, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT id, phone FROM customers WHERE deleted_at IS NULL AND tenant_id = ? AND phone = ? ${excludeId ? 'AND id <> ?' : ''} LIMIT 1`,
    excludeId ? [tenantId, phone, excludeId] : [tenantId, phone],
  );
  return rows[0] || null;
}

export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    `SELECT id, customer_code, first_name, last_name, business_name, phone, customer_type
     FROM customers WHERE tenant_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY first_name, last_name`,
    [tenantId],
  );
  return rows;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, customerType, status }) {
  const conditions = ['deleted_at IS NULL', 'tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(first_name LIKE ? OR last_name LIKE ? OR business_name LIKE ? OR phone LIKE ? OR customer_code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }
  if (customerType) {
    conditions.push('customer_type = ?');
    params.push(customerType);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM customers ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM customers ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({
  tenantId, customerCode, firstName, lastName, businessName, phone, altPhone, email,
  address, notes, region, district, tinNumber, customerType, status, userId,
}) {
  const [result] = await pool.query(
    `INSERT INTO customers
       (tenant_id, customer_code, first_name, last_name, business_name, phone, alt_phone, email,
        address, notes, region, district, tin_number, customer_type, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId, customerCode, firstName, lastName || '', businessName || null, phone, altPhone || null, email || null,
      address || null, notes || null, region || null, district || null, tinNumber || null,
      customerType || 'walk_in', status || 'active', userId, userId,
    ],
  );
  return findById(result.insertId, tenantId);
}

// customerType/status are NOT NULL columns with a DB default, but this
// UPDATE (unlike create()) has no default to fall back to — the simplified
// customer form no longer sends either field at all. COALESCE(?, column)
// keeps the existing value in place when the caller omits it, rather than
// writing NULL into a NOT NULL column (which the previous plain `= ?`
// would have done the moment this form stopped sending customerType/status).
export async function update(id, tenantId, {
  firstName, lastName, businessName, phone, altPhone, email,
  address, notes, region, district, tinNumber, customerType, status, userId,
}) {
  await pool.query(
    `UPDATE customers SET
       first_name = ?, last_name = ?, business_name = ?, phone = ?, alt_phone = ?, email = ?,
       address = ?, notes = ?, region = ?, district = ?, tin_number = ?,
       customer_type = COALESCE(?, customer_type), status = COALESCE(?, status), updated_by = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      firstName, lastName || '', businessName || null, phone, altPhone || null, email || null,
      address || null, notes || null, region || null, district || null, tinNumber || null,
      customerType || null, status || null, userId, id, tenantId,
    ],
  );
  return findById(id, tenantId);
}

export async function updateStatus(id, tenantId, status, userId) {
  await pool.query('UPDATE customers SET status = ?, updated_by = ? WHERE id = ? AND tenant_id = ?', [status, userId, id, tenantId]);
  return findById(id, tenantId);
}

// A real DELETE, not a status/deleted_at change — sales.customer_id and
// returns.customer_id are both ON DELETE SET NULL (see
// 006_create_sales_pos.sql), so this always succeeds even for a customer
// with transaction history; those rows just lose the customer link instead
// of blocking the delete.
export async function hardDelete(id, tenantId) {
  const [result] = await pool.query('DELETE FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  return result.affectedRows > 0;
}

export async function findPurchaseHistory(customerId, tenantId, { page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT id, sale_number, branch_id, total_amount, status, created_at
     FROM sales WHERE customer_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [customerId, tenantId, limit, offset],
  );
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM sales WHERE customer_id = ? AND tenant_id = ?', [customerId, tenantId]);
  return { rows, total };
}

export async function findReturnHistory(customerId, tenantId, { page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT id, return_number, sale_id, reason, status, refund_amount, refund_status, created_at
     FROM returns WHERE customer_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [customerId, tenantId, limit, offset],
  );
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM returns WHERE customer_id = ? AND tenant_id = ?', [customerId, tenantId]);
  return { rows, total };
}

export async function getStatistics(customerId, tenantId) {
  const [[sales]] = await pool.query(
    `SELECT COUNT(*) AS totalOrders, COALESCE(SUM(total_amount), 0) AS totalSpent
     FROM sales WHERE customer_id = ? AND tenant_id = ? AND status != 'voided'`,
    [customerId, tenantId],
  );
  const [[returns]] = await pool.query('SELECT COUNT(*) AS totalReturns FROM returns WHERE customer_id = ? AND tenant_id = ?', [customerId, tenantId]);

  return {
    totalOrders: Number(sales.totalOrders),
    totalSpent: Number(sales.totalSpent),
    totalReturns: Number(returns.totalReturns),
  };
}
