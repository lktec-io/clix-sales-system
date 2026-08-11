import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    `SELECT r.*, l.loan_number, c.first_name AS borrower_first_name, c.last_name AS borrower_last_name
     FROM loan_repayments r
     JOIN loans l ON l.id = r.loan_id
     JOIN customers c ON c.id = l.customer_id
     WHERE r.id = ? AND r.tenant_id = ? LIMIT 1`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function findByLoan(loanId, tenantId) {
  const [rows] = await pool.query(
    'SELECT * FROM loan_repayments WHERE loan_id = ? AND tenant_id = ? ORDER BY payment_date DESC, id DESC',
    [loanId, tenantId],
  );
  return rows;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, branchIds, loanId }) {
  const scope = buildScope({ tenantId, tenantColumn: 'r.tenant_id', branchIds, branchColumn: 'r.branch_id' });
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    conditions.push('(r.receipt_number LIKE ? OR l.loan_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (loanId) {
    conditions.push('r.loan_id = ?');
    params.push(loanId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];
  const offset = (page - 1) * limit;

  const baseFrom = `
    FROM loan_repayments r
    JOIN loans l ON l.id = r.loan_id
    JOIN customers c ON c.id = l.customer_id
  `;

  const [rows] = await pool.query(
    `SELECT r.*, l.loan_number, l.principal_outstanding, l.interest_outstanding,
            c.first_name AS borrower_first_name, c.last_name AS borrower_last_name
     ${baseFrom} ${whereClause} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${baseFrom} ${whereClause}`, allParams);

  return { rows, total: countRows[0].total };
}

export async function create({
  tenantId, loanId, branchId, receiptNumber, amount, paymentDate, paymentMethod, reference, recordedBy,
}, connection) {
  const [result] = await connection.query(
    `INSERT INTO loan_repayments (tenant_id, loan_id, branch_id, receipt_number, amount, payment_date, payment_method, reference, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, loanId, branchId, receiptNumber, amount, paymentDate, paymentMethod || 'cash', reference || null, recordedBy],
  );
  return result.insertId;
}

export async function createAllocation(repaymentId, scheduleId, amountApplied, connection) {
  await connection.query(
    'INSERT INTO loan_repayment_allocations (loan_repayment_id, loan_schedule_id, amount_applied) VALUES (?, ?, ?)',
    [repaymentId, scheduleId, amountApplied],
  );
}

export async function getCollectionsSummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'tenant_id', branchIds, branchColumn: 'branch_id' });
  const [[today]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS value FROM loan_repayments WHERE payment_date = CURDATE() ${scope.clause}`,
    scope.params,
  );
  const [[total]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS value FROM loan_repayments WHERE 1 = 1 ${scope.clause}`,
    scope.params,
  );
  return { todayCollections: Number(today.value), totalCollected: Number(total.value) };
}
