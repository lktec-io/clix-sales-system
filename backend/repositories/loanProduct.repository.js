import { pool } from '../config/db.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    'SELECT * FROM loan_products WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1',
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function findAllActive(tenantId) {
  const [rows] = await pool.query(
    "SELECT * FROM loan_products WHERE tenant_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY name",
    [tenantId],
  );
  return rows;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status }) {
  const conditions = ['deleted_at IS NULL', 'tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('name LIKE ?');
    params.push(`%${search}%`);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM loan_products ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM loan_products ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({
  tenantId, name, minAmount, maxAmount, interestRate, interestMethod,
  durationValue, durationUnit, repaymentFrequency, processingFeePercent, status, userId,
}) {
  const [result] = await pool.query(
    `INSERT INTO loan_products
       (tenant_id, name, min_amount, max_amount, interest_rate, interest_method,
        duration_value, duration_unit, repayment_frequency, processing_fee_percent, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId, name, minAmount, maxAmount, interestRate, interestMethod,
      durationValue, durationUnit, repaymentFrequency, processingFeePercent || 0, status || 'active', userId, userId,
    ],
  );
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, {
  name, minAmount, maxAmount, interestRate, interestMethod,
  durationValue, durationUnit, repaymentFrequency, processingFeePercent, status, userId,
}) {
  await pool.query(
    `UPDATE loan_products SET
       name = ?, min_amount = ?, max_amount = ?, interest_rate = ?, interest_method = ?,
       duration_value = ?, duration_unit = ?, repayment_frequency = ?, processing_fee_percent = ?,
       status = ?, updated_by = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      name, minAmount, maxAmount, interestRate, interestMethod,
      durationValue, durationUnit, repaymentFrequency, processingFeePercent || 0,
      status, userId, id, tenantId,
    ],
  );
  return findById(id, tenantId);
}

export async function updateStatus(id, tenantId, status, userId) {
  await pool.query('UPDATE loan_products SET status = ?, updated_by = ? WHERE id = ? AND tenant_id = ?', [status, userId, id, tenantId]);
  return findById(id, tenantId);
}

// Soft delete only — existing loans reference loan_product_id with
// ON DELETE RESTRICT, so a product with loan history could never be hard
// deleted anyway; deactivating (status) is the everyday action, this is
// for removing a product that was created by mistake and never used.
export async function softDelete(id, tenantId) {
  await pool.query('UPDATE loan_products SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

export async function countLoansUsingProduct(id, tenantId) {
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM loans WHERE loan_product_id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  return Number(total);
}
