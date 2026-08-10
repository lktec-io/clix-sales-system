import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

const DETAIL_SELECT = `
  SELECT sa.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone
  FROM savings_accounts sa
  JOIN customers c ON c.id = sa.customer_id
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE sa.id = ? AND sa.tenant_id = ? LIMIT 1`, [id, tenantId]);
  return rows[0] || null;
}

// Locks the row for the duration of the enclosing transaction so two
// concurrent withdrawals against the same account can never both read the
// same "balance before" and overdraw it — record()'s caller always wraps
// this in a transaction and passes that connection through.
export async function findByIdForUpdate(id, tenantId, connection) {
  const [rows] = await connection.query(
    'SELECT * FROM savings_accounts WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE',
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, customerId }) {
  const conditions = ['sa.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(sa.account_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (customerId) {
    conditions.push('sa.customer_id = ?');
    params.push(customerId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${DETAIL_SELECT} ${whereClause} ORDER BY sa.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM savings_accounts sa JOIN customers c ON c.id = sa.customer_id ${whereClause}`,
    params,
  );

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, customerId, accountNumber, openedBy }) {
  const [result] = await pool.query(
    'INSERT INTO savings_accounts (tenant_id, customer_id, account_number, opened_by) VALUES (?, ?, ?, ?)',
    [tenantId, customerId, accountNumber, openedBy],
  );
  return findById(result.insertId, tenantId);
}

export async function updateBalance(id, newBalance, connection) {
  await connection.query('UPDATE savings_accounts SET balance = ? WHERE id = ?', [newBalance, id]);
}

export async function findTransactions(savingsAccountId, tenantId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT * FROM savings_transactions WHERE savings_account_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [savingsAccountId, tenantId, limit, offset],
  );
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM savings_transactions WHERE savings_account_id = ? AND tenant_id = ?',
    [savingsAccountId, tenantId],
  );
  return { rows, total };
}

export async function createTransaction({ tenantId, savingsAccountId, branchId, type, amount, balanceAfter, reference, recordedBy }, connection) {
  await connection.query(
    `INSERT INTO savings_transactions (tenant_id, savings_account_id, branch_id, type, amount, balance_after, reference, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, savingsAccountId, branchId, type, amount, balanceAfter, reference || null, recordedBy],
  );
}

// savings_accounts has no branch_id column (a customer's own account isn't
// branch-owned the way a sale or a repayment transaction is) — tenant scope
// only, branchIds is accepted for call-site symmetry with the other
// dashboard summary functions but intentionally unused here.
export async function getTotalBalance(tenantId) {
  const scope = buildScope({ tenantId });
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(balance), 0) AS value FROM savings_accounts WHERE status = 'active' ${scope.clause}`,
    scope.params,
  );
  return Number(row.value);
}
