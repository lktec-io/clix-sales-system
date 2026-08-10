import { pool } from '../config/db.js';

export async function findByLoan(loanId) {
  const [rows] = await pool.query(
    'SELECT * FROM loan_schedules WHERE loan_id = ? ORDER BY installment_number ASC',
    [loanId],
  );
  return rows;
}

// Oldest-due-first — loan.service.js's repayment allocator always settles
// the earliest outstanding installment before a later one, regardless of
// which installment the payer thinks they're paying toward.
export async function findUnpaidByLoan(loanId, connection = pool) {
  const [rows] = await connection.query(
    "SELECT * FROM loan_schedules WHERE loan_id = ? AND status IN ('pending','partial') ORDER BY due_date ASC FOR UPDATE",
    [loanId],
  );
  return rows;
}

export async function bulkCreate(loanId, installments, connection) {
  for (const installment of installments) {
    await connection.query(
      `INSERT INTO loan_schedules (loan_id, installment_number, due_date, principal_due, interest_due, fees_due, total_due)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        loanId, installment.installmentNumber, installment.dueDate,
        installment.principalDue, installment.interestDue, installment.feesDue || 0, installment.totalDue,
      ],
    );
  }
}

export async function applyPayment(scheduleId, { amountPaid, status }, connection) {
  await connection.query(
    'UPDATE loan_schedules SET amount_paid = ?, status = ? WHERE id = ?',
    [amountPaid, status, scheduleId],
  );
}

// Flips any schedule whose due date has passed and still isn't fully paid
// to 'overdue' — called lazily (report/dashboard reads, loan detail loads)
// rather than a cron, since the status only needs to be correct at read
// time, not continuously ticking in the background.
export async function markOverdueForTenant(tenantId) {
  await pool.query(
    `UPDATE loan_schedules s
     JOIN loans l ON l.id = s.loan_id
     SET s.status = 'overdue'
     WHERE l.tenant_id = ? AND l.status = 'active' AND s.status IN ('pending','partial') AND s.due_date < CURDATE()`,
    [tenantId],
  );
}
