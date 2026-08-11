import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

// LEFT JOIN loan_products — the simplified Microfinance workflow creates
// loans with directly-entered terms and no product at all (loan_product_id
// is nullable; see 030_simplify_microfinance_loans.sql), so this must not
// exclude those rows the way an inner JOIN would.
const DETAIL_SELECT = `
  SELECT l.*,
         c.first_name AS borrower_first_name, c.last_name AS borrower_last_name,
         c.phone AS borrower_phone, c.customer_code AS borrower_code,
         lp.name AS loan_product_name,
         b.name AS branch_name
  FROM loans l
  JOIN customers c ON c.id = l.customer_id
  LEFT JOIN loan_products lp ON lp.id = l.loan_product_id
  JOIN branches b ON b.id = l.branch_id
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE l.id = ? AND l.tenant_id = ? LIMIT 1`, [id, tenantId]);
  return rows[0] || null;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status, customerId, branchId, branchIds }) {
  const scope = buildScope({ tenantId, tenantColumn: 'l.tenant_id', branchIds, branchColumn: 'l.branch_id' });
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    conditions.push('(l.loan_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (status) {
    conditions.push('l.status = ?');
    params.push(status);
  }
  if (customerId) {
    conditions.push('l.customer_id = ?');
    params.push(customerId);
  }
  if (branchId) {
    conditions.push('l.branch_id = ?');
    params.push(branchId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${DETAIL_SELECT} ${whereClause} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM loans l JOIN customers c ON c.id = l.customer_id ${whereClause}`,
    allParams,
  );

  return { rows, total: countRows[0].total };
}

export async function create({
  tenantId, branchId, loanNumber, customerId, loanProductId, requestedAmount,
  interestRate, interestMethod, durationValue, durationUnit, repaymentFrequency,
  processingFeeAmount, purpose, requestedStartDate, appliedBy,
}, connection = pool) {
  const [result] = await connection.query(
    `INSERT INTO loans
       (tenant_id, branch_id, loan_number, customer_id, loan_product_id, requested_amount,
        interest_rate, interest_method, duration_value, duration_unit, repayment_frequency,
        processing_fee_amount, purpose, requested_start_date, status, applied_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
    [
      tenantId, branchId, loanNumber, customerId, loanProductId, requestedAmount,
      interestRate, interestMethod, durationValue, durationUnit, repaymentFrequency,
      processingFeeAmount || 0, purpose || null, requestedStartDate || null, appliedBy,
    ],
  );
  return result.insertId;
}

export async function setUnderReview(id, tenantId) {
  await pool.query("UPDATE loans SET status = 'under_review' WHERE id = ? AND tenant_id = ? AND status = 'submitted'", [id, tenantId]);
}

export async function approve(id, tenantId, { approvedAmount, approvedBy }) {
  await pool.query(
    `UPDATE loans SET status = 'approved', approved_amount = ?, approved_by = ?, approved_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [approvedAmount, approvedBy, id, tenantId],
  );
}

export async function reject(id, tenantId, { rejectionReason, approvedBy }) {
  await pool.query(
    `UPDATE loans SET status = 'rejected', rejection_reason = ?, approved_by = ?, approved_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [rejectionReason || null, approvedBy, id, tenantId],
  );
}

export async function markDisbursed(id, tenantId, { disbursedBy, principalOutstanding, interestOutstanding }, connection = pool) {
  await connection.query(
    `UPDATE loans SET status = 'active', disbursed_by = ?, disbursed_at = NOW(),
       principal_outstanding = ?, interest_outstanding = ?
     WHERE id = ? AND tenant_id = ?`,
    [disbursedBy, principalOutstanding, interestOutstanding, id, tenantId],
  );
}

export async function updateOutstanding(id, tenantId, { principalOutstanding, interestOutstanding, completed }, connection = pool) {
  await connection.query(
    `UPDATE loans SET principal_outstanding = ?, interest_outstanding = ?, status = IF(?, 'completed', status)
     WHERE id = ? AND tenant_id = ?`,
    [principalOutstanding, interestOutstanding, completed ? 1 : 0, id, tenantId],
  );
}

export async function writeOff(id, tenantId, userId) {
  await pool.query(
    "UPDATE loans SET status = 'written_off', updated_at = NOW() WHERE id = ? AND tenant_id = ? AND status IN ('active','defaulted')",
    [id, tenantId],
  );
  return userId;
}

// Portfolio-wide aggregates for the Dashboard/Reports — always scoped to
// the calling tenant, never a cross-tenant read.
export async function getPortfolioSummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'tenant_id', branchIds, branchColumn: 'branch_id' });

  const [[borrowers]] = await pool.query(
    `SELECT COUNT(DISTINCT customer_id) AS value FROM loans WHERE status IN ('active','completed','disbursed') ${scope.clause}`,
    scope.params,
  );
  const [[totalLoans]] = await pool.query(
    `SELECT COUNT(*) AS value FROM loans WHERE 1 = 1 ${scope.clause}`,
    scope.params,
  );
  const [[activeLoans]] = await pool.query(
    `SELECT COUNT(*) AS value FROM loans WHERE status = 'active' ${scope.clause}`,
    scope.params,
  );
  const [[completedLoans]] = await pool.query(
    `SELECT COUNT(*) AS value FROM loans WHERE status = 'completed' ${scope.clause}`,
    scope.params,
  );
  const [[disbursed]] = await pool.query(
    `SELECT COALESCE(SUM(approved_amount), 0) AS value FROM loans WHERE status IN ('active','completed','defaulted','written_off') ${scope.clause}`,
    scope.params,
  );
  const [[outstanding]] = await pool.query(
    `SELECT COALESCE(SUM(principal_outstanding + interest_outstanding), 0) AS value FROM loans WHERE status = 'active' ${scope.clause}`,
    scope.params,
  );
  const [[pending]] = await pool.query(
    `SELECT COUNT(*) AS value FROM loans WHERE status IN ('submitted','under_review') ${scope.clause}`,
    scope.params,
  );

  return {
    totalBorrowers: Number(borrowers.value),
    totalLoans: Number(totalLoans.value),
    activeLoans: Number(activeLoans.value),
    completedLoans: Number(completedLoans.value),
    totalDisbursed: Number(disbursed.value),
    outstandingBalance: Number(outstanding.value),
    pendingApplications: Number(pending.value),
  };
}

// The Dashboard's "Recent Loan Applications" list — any status, newest
// first, capped small since this is a glance-at-a-glance widget, not a
// substitute for the full Loans list page.
export async function findRecent(tenantId, branchIds, limit = 5) {
  const scope = buildScope({ tenantId, tenantColumn: 'l.tenant_id', branchIds, branchColumn: 'l.branch_id' });
  const [rows] = await pool.query(
    `SELECT l.id, l.loan_number, l.requested_amount, l.approved_amount, l.status, l.created_at,
            c.first_name AS borrower_first_name, c.last_name AS borrower_last_name
     FROM loans l JOIN customers c ON c.id = l.customer_id
     WHERE 1 = 1 ${scope.clause}
     ORDER BY l.created_at DESC LIMIT ?`,
    [...scope.params, limit],
  );
  return rows;
}

export async function getOverdueSummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'l.tenant_id', branchIds, branchColumn: 'l.branch_id' });
  const [[row]] = await pool.query(
    `SELECT COUNT(DISTINCT l.id) AS overdueLoans, COALESCE(SUM(s.total_due - s.amount_paid), 0) AS portfolioAtRisk
     FROM loan_schedules s
     JOIN loans l ON l.id = s.loan_id
     WHERE l.status = 'active' AND s.status IN ('pending','partial') AND s.due_date < CURDATE() ${scope.clause}`,
    scope.params,
  );
  return { overdueLoans: Number(row.overdueLoans), portfolioAtRisk: Number(row.portfolioAtRisk) };
}
