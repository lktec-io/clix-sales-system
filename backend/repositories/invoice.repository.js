import { pool } from '../config/db.js';

export async function create({
  tenantId, subscriptionId, eventId, invoiceNumber, referenceNumber, planId, planNameSnapshot, billingCycle,
  periodStart, periodEnd, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, currency, notes,
}) {
  const [result] = await pool.query(
    `INSERT INTO invoices
       (tenant_id, subscription_id, event_id, invoice_number, reference_number, plan_id, plan_name_snapshot, billing_cycle,
        period_start, period_end, issue_date, due_date, subtotal, tax_amount, discount_amount, total, currency, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId, subscriptionId, eventId || null, invoiceNumber, referenceNumber || null, planId || null, planNameSnapshot, billingCycle,
      periodStart, periodEnd, issueDate, dueDate, subtotal, taxAmount || 0, discountAmount || 0, total, currency || 'TZS', notes || null,
    ],
  );
  return findById(result.insertId);
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM invoices WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// tenantId-scoped variant used by the tenant-facing controller so a tenant
// can never fetch another tenant's invoice by guessing an id.
export async function findByIdForTenant(id, tenantId) {
  const [rows] = await pool.query('SELECT * FROM invoices WHERE id = ? AND tenant_id = ? LIMIT 1', [id, tenantId]);
  return rows[0] || null;
}

export async function findByTenant(tenantId, { page = 1, limit = 20, paymentStatus } = {}) {
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];

  if (paymentStatus) {
    conditions.push('payment_status = ?');
    params.push(paymentStatus);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM invoices ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM invoices ${whereClause}`, params);

  return { rows, total };
}

export async function findAllForPlatform({ page = 1, limit = 20, tenantId, paymentStatus } = {}) {
  const conditions = ['1 = 1'];
  const params = [];

  if (tenantId) {
    conditions.push('i.tenant_id = ?');
    params.push(tenantId);
  }
  if (paymentStatus) {
    conditions.push('i.payment_status = ?');
    params.push(paymentStatus);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT i.*, t.company_name FROM invoices i JOIN tenants t ON t.id = i.tenant_id
     ${whereClause} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM invoices i ${whereClause}`, params);

  return { rows, total };
}

export async function markPaid(id) {
  await pool.query("UPDATE invoices SET payment_status = 'paid', paid_at = NOW() WHERE id = ?", [id]);
  return findById(id);
}
