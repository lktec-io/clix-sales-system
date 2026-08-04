import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

const BASE_SELECT = `
  SELECT e.*, ec.name AS category_name, b.name AS branch_name,
         u.first_name AS paid_by_first_name, u.last_name AS paid_by_last_name
  FROM expenses e
  JOIN expense_categories ec ON ec.id = e.expense_category_id
  JOIN branches b ON b.id = e.branch_id
  LEFT JOIN users u ON u.id = e.paid_by
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE e.id = ? AND e.tenant_id = ? AND e.deleted_at IS NULL LIMIT 1`, [id, tenantId]);
  return rows[0] || null;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, categoryId, branchId, dateFrom, dateTo, branchIds }) {
  const conditions = ['e.deleted_at IS NULL'];
  const params = [];

  if (search) {
    conditions.push('e.description LIKE ?');
    params.push(`%${search}%`);
  }
  if (categoryId) {
    conditions.push('e.expense_category_id = ?');
    params.push(categoryId);
  }
  if (branchId) {
    conditions.push('e.branch_id = ?');
    params.push(branchId);
  }
  if (dateFrom) {
    conditions.push('e.expense_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('e.expense_date <= ?');
    params.push(dateTo);
  }

  const scope = buildScope({ tenantId, tenantColumn: 'e.tenant_id', branchIds, branchColumn: 'e.branch_id' });
  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const offset = (page - 1) * limit;
  const allParams = [...params, ...scope.params];

  const [rows] = await pool.query(
    `${BASE_SELECT} ${whereClause} ORDER BY e.expense_date DESC, e.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM expenses e ${whereClause}`, allParams);
  const [[{ totalAmount }]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS totalAmount FROM expenses e ${whereClause}`,
    allParams,
  );

  return { rows, total: countRows[0].total, totalAmount: Number(totalAmount) };
}

export async function create({ tenantId, expenseCategoryId, branchId, amount, description, expenseDate, userId }) {
  const [result] = await pool.query(
    `INSERT INTO expenses (tenant_id, expense_category_id, branch_id, amount, description, paid_by, expense_date, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`,
    [tenantId, expenseCategoryId, branchId, amount, description || null, userId, expenseDate, userId, userId],
  );
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { expenseCategoryId, branchId, amount, description, expenseDate, userId }) {
  await pool.query(
    `UPDATE expenses SET expense_category_id = ?, branch_id = ?, amount = ?, description = ?, expense_date = ?, updated_by = ?
     WHERE id = ? AND tenant_id = ?`,
    [expenseCategoryId, branchId, amount, description || null, expenseDate, userId, id, tenantId],
  );
  return findById(id, tenantId);
}

export async function softDelete(id, tenantId, userId) {
  await pool.query('UPDATE expenses SET deleted_at = NOW(), updated_by = ? WHERE id = ? AND tenant_id = ?', [userId, id, tenantId]);
}
