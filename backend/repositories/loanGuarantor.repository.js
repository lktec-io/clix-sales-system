import { pool } from '../config/db.js';

export async function findByLoan(loanId) {
  const [rows] = await pool.query(
    `SELECT g.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name
     FROM loan_guarantors g
     LEFT JOIN customers c ON c.id = g.customer_id
     WHERE g.loan_id = ? ORDER BY g.created_at ASC`,
    [loanId],
  );
  return rows;
}

export async function create({ loanId, customerId, guarantorName, guarantorPhone, guaranteedAmount }, connection = pool) {
  const [result] = await connection.query(
    `INSERT INTO loan_guarantors (loan_id, customer_id, guarantor_name, guarantor_phone, guaranteed_amount)
     VALUES (?, ?, ?, ?, ?)`,
    [loanId, customerId || null, guarantorName, guarantorPhone || null, guaranteedAmount],
  );
  return result.insertId;
}

export async function release(id, loanId) {
  await pool.query("UPDATE loan_guarantors SET status = 'released' WHERE id = ? AND loan_id = ?", [id, loanId]);
}
