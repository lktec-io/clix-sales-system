import { pool } from '../config/db.js';

export async function create({
  tenantId, subscriptionId, invoiceId, planId, amount, currency, provider,
  internalReference, status, paymentMethod, metadata,
}) {
  const [result] = await pool.query(
    `INSERT INTO payments
       (tenant_id, subscription_id, invoice_id, plan_id, amount, currency, provider, internal_reference, status, payment_method, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId, subscriptionId, invoiceId || null, planId || null, amount, currency || 'TZS', provider,
      internalReference, status || 'pending', paymentMethod || null, metadata ? JSON.stringify(metadata) : null,
    ],
  );
  return findById(result.insertId);
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// tenantId-scoped variant — mirrors invoiceRepository.findByIdForTenant's
// exact reasoning: a tenant must never be able to read another tenant's
// payment row by guessing an id.
export async function findByIdForTenant(id, tenantId) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = ? AND tenant_id = ? LIMIT 1', [id, tenantId]);
  return rows[0] || null;
}

// The idempotency anchor — every confirm/fail path looks a payment up by
// the reference the server itself generated at checkout-initiation time,
// never by a client- or provider-supplied id alone.
export async function findByInternalReference(internalReference) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE internal_reference = ? LIMIT 1', [internalReference]);
  return rows[0] || null;
}

export async function findByProviderTransactionId(provider, providerTransactionId) {
  const [rows] = await pool.query(
    'SELECT * FROM payments WHERE provider = ? AND provider_transaction_id = ? LIMIT 1',
    [provider, providerTransactionId],
  );
  return rows[0] || null;
}

export async function findByTenant(tenantId, { page = 1, limit = 20, status } = {}) {
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM payments ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM payments ${whereClause}`, params);

  return { rows, total };
}

export async function findAllForPlatform({ page = 1, limit = 20, tenantId, status, provider } = {}) {
  const conditions = ['1 = 1'];
  const params = [];

  if (tenantId) {
    conditions.push('p.tenant_id = ?');
    params.push(tenantId);
  }
  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }
  if (provider) {
    conditions.push('p.provider = ?');
    params.push(provider);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT p.*, t.company_name, sp.name AS plan_name, i.invoice_number
     FROM payments p
     JOIN tenants t ON t.id = p.tenant_id
     LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM payments p ${whereClause}`, params);

  return { rows, total };
}

// Every mutation below is a narrow, single-purpose status transition —
// mirrors tenantSubscription.repository.js's own convention (activate(),
// cancel(), resume() as distinct setters rather than one generic update).
// WHERE ... status IN ('pending','processing') makes this a
// compare-and-swap: two near-simultaneous confirmations for the same
// payment (a webhook retry racing a platform admin's manual click) can
// each pass an earlier, unlocked status read, but only the first UPDATE
// actually flips a row — the second affects zero rows, and its caller
// (payment.service.js#applyConfirmedPayment) treats that as the already-
// processed, idempotent no-op it already handles for a plain re-read.
export async function markSucceeded(id, { providerTransactionId, paymentMethod, metadata }) {
  const [result] = await pool.query(
    `UPDATE payments
     SET status = 'succeeded', paid_at = NOW(), provider_transaction_id = ?, payment_method = ?,
         metadata = ?, failure_reason = NULL
     WHERE id = ? AND status IN ('pending', 'processing')`,
    [providerTransactionId || null, paymentMethod || null, metadata ? JSON.stringify(metadata) : null, id],
  );
  return { affected: result.affectedRows > 0, payment: await findById(id) };
}

export async function markFailed(id, { failureReason, providerTransactionId, metadata }) {
  await pool.query(
    `UPDATE payments
     SET status = 'failed', failure_reason = ?, provider_transaction_id = COALESCE(?, provider_transaction_id),
         metadata = COALESCE(?, metadata)
     WHERE id = ?`,
    [failureReason || null, providerTransactionId || null, metadata ? JSON.stringify(metadata) : null, id],
  );
  return findById(id);
}

export async function markProcessing(id, { providerTransactionId }) {
  await pool.query(
    "UPDATE payments SET status = 'processing', provider_transaction_id = COALESCE(?, provider_transaction_id) WHERE id = ?",
    [providerTransactionId || null, id],
  );
  return findById(id);
}

export async function markCancelled(id) {
  await pool.query("UPDATE payments SET status = 'cancelled' WHERE id = ?", [id]);
  return findById(id);
}

// Billing-dashboard-style aggregate, same shape as
// tenantSubscription.repository.js's getStatusCounts() — one GROUP BY, no
// per-tile loop.
export async function getStatusCounts() {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS total FROM payments GROUP BY status');
  const counts = { pending: 0, processing: 0, succeeded: 0, failed: 0, cancelled: 0 };
  for (const row of rows) counts[row.status] = Number(row.total);
  return counts;
}
