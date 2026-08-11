import { pool } from '../config/db.js';

// Atomic "create the row if it doesn't exist yet, then read it" — same
// INSERT-then-no-op idiom sequence.repository.js's generateCode() already
// uses, relying on uq_tenant_subscriptions_tenant for race safety instead of
// a SELECT...FOR UPDATE transaction. Only ever needed for a tenant that
// somehow slipped past 024_create_billing_tables.sql's backfill (in
// practice, none after migration day) — this phase never threads creation
// into tenant.service.js's register(), which stays untouched.
export async function getOrCreateForTenant(tenantId, defaults) {
  const existing = await findByTenantId(tenantId);
  if (existing) return existing;

  await pool.query(
    `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, billing_cycle, start_date, end_date, renewal_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tenant_id = tenant_id`,
    [
      tenantId, defaults.planId, defaults.status, defaults.billingCycle,
      defaults.startDate, defaults.endDate, defaults.renewalDate,
    ],
  );
  return findByTenantId(tenantId);
}

export async function findByTenantId(tenantId) {
  const [rows] = await pool.query(
    `SELECT ts.*, p.name AS plan_name, p.slug AS plan_slug
     FROM tenant_subscriptions ts JOIN subscription_plans p ON p.id = ts.plan_id
     WHERE ts.tenant_id = ? LIMIT 1`,
    [tenantId],
  );
  return rows[0] || null;
}

// Row-locking variant for payment.service.js#initiateCheckout — closes the
// race where two concurrent checkout requests for the same tenant both
// read status !== 'pending_payment' before either write lands, creating
// two invoices/payments for one upgrade. Must run inside a transaction on
// `connection`; the lock releases on that transaction's commit/rollback,
// same FOR UPDATE pattern inventoryRepository.recordMovement() already
// uses for its own read-check-write race.
export async function findByTenantIdForUpdate(tenantId, connection) {
  const [rows] = await connection.query(
    `SELECT ts.*, p.name AS plan_name, p.slug AS plan_slug
     FROM tenant_subscriptions ts JOIN subscription_plans p ON p.id = ts.plan_id
     WHERE ts.tenant_id = ? LIMIT 1 FOR UPDATE`,
    [tenantId],
  );
  return rows[0] || null;
}

export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ts.*, p.name AS plan_name, p.slug AS plan_slug
     FROM tenant_subscriptions ts JOIN subscription_plans p ON p.id = ts.plan_id
     WHERE ts.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

// Shared by upgradePlan/downgradePlan in subscriptionLifecycle.service.js —
// the SQL doesn't need to know direction, only the service's event-log
// entry does, so one repository function serves both rather than two
// near-identical UPDATEs.
export async function changePlan(tenantId, { planId, billingCycle }) {
  await pool.query('UPDATE tenant_subscriptions SET plan_id = ?, billing_cycle = ? WHERE tenant_id = ?', [planId, billingCycle, tenantId]);
  return findByTenantId(tenantId);
}

// First-ever conversion out of a trial onto a paid plan — status lands on
// pending_payment (not active) until markInvoicePaid confirms it, exactly
// the seam a real checkout occupies (payment.service.js#initiateCheckout).
// Optional `connection` (default `pool`) lets initiateCheckout run this as
// part of the same locked transaction as findByTenantIdForUpdate() above —
// every other caller (subscriptionLifecycle.service.js's admin-driven
// upgradePlan) is unaffected, since the default is identical to before.
export async function convertFromTrial(tenantId, { planId, billingCycle, startDate, endDate, renewalDate }, connection = pool) {
  await connection.query(
    `UPDATE tenant_subscriptions
     SET plan_id = ?, billing_cycle = ?, status = 'pending_payment', start_date = ?, end_date = ?, renewal_date = ?
     WHERE tenant_id = ?`,
    [planId, billingCycle, startDate, endDate, renewalDate, tenantId],
  );
  const [rows] = await connection.query(
    `SELECT ts.*, p.name AS plan_name, p.slug AS plan_slug
     FROM tenant_subscriptions ts JOIN subscription_plans p ON p.id = ts.plan_id
     WHERE ts.tenant_id = ? LIMIT 1`,
    [tenantId],
  );
  return rows[0] || null;
}

// Extends the paid period to the next cycle but leaves activation pending
// confirmation (markInvoicePaid) — mirrors convertFromTrial's reasoning.
export async function renew(tenantId, { endDate, renewalDate }) {
  await pool.query(
    "UPDATE tenant_subscriptions SET status = 'pending_payment', end_date = ?, renewal_date = ? WHERE tenant_id = ?",
    [endDate, renewalDate, tenantId],
  );
  return findByTenantId(tenantId);
}

export async function activate(tenantId, { trialConverted = false } = {}) {
  if (trialConverted) {
    await pool.query(
      "UPDATE tenant_subscriptions SET status = 'active', trial_converted_at = NOW(), grace_period_ends_at = NULL WHERE tenant_id = ?",
      [tenantId],
    );
  } else {
    await pool.query("UPDATE tenant_subscriptions SET status = 'active', grace_period_ends_at = NULL WHERE tenant_id = ?", [tenantId]);
  }
  return findByTenantId(tenantId);
}

// Reverts a rejected/failed checkout out of 'pending_payment' back to
// whatever status made sense before the attempt, so the tenant isn't
// permanently locked out of ever checking out again (initiateCheckout's
// own guard refuses to start a new checkout while status is
// 'pending_payment') and isn't left in a state markInvoicePaid never
// expected to see. Guarded by `AND status = 'pending_payment'` so it's a
// safe no-op if the payment was somehow already resolved another way.
export async function revertPendingPayment(tenantId, fallbackStatus) {
  await pool.query(
    "UPDATE tenant_subscriptions SET status = ? WHERE tenant_id = ? AND status = 'pending_payment'",
    [fallbackStatus, tenantId],
  );
  return findByTenantId(tenantId);
}

export async function cancel(tenantId, { reason }) {
  await pool.query(
    "UPDATE tenant_subscriptions SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = ?, auto_renew = FALSE WHERE tenant_id = ?",
    [reason || null, tenantId],
  );
  return findByTenantId(tenantId);
}

export async function resume(tenantId) {
  await pool.query(
    "UPDATE tenant_subscriptions SET status = 'active', cancelled_at = NULL, cancellation_reason = NULL WHERE tenant_id = ?",
    [tenantId],
  );
  return findByTenantId(tenantId);
}

export async function scheduleChange(tenantId, { planId, billingCycle, effectiveDate }) {
  await pool.query(
    'UPDATE tenant_subscriptions SET scheduled_plan_id = ?, scheduled_billing_cycle = ?, scheduled_effective_date = ? WHERE tenant_id = ?',
    [planId, billingCycle, effectiveDate, tenantId],
  );
  return findByTenantId(tenantId);
}

export async function clearSchedule(tenantId) {
  await pool.query(
    'UPDATE tenant_subscriptions SET scheduled_plan_id = NULL, scheduled_billing_cycle = NULL, scheduled_effective_date = NULL WHERE tenant_id = ?',
    [tenantId],
  );
  return findByTenantId(tenantId);
}

export async function applyScheduledChange(subscriptionId, { planId, billingCycle }) {
  await pool.query(
    `UPDATE tenant_subscriptions
     SET plan_id = ?, billing_cycle = ?, scheduled_plan_id = NULL, scheduled_billing_cycle = NULL, scheduled_effective_date = NULL
     WHERE id = ?`,
    [planId, billingCycle, subscriptionId],
  );
  return findById(subscriptionId);
}

export async function transitionToGracePeriod(subscriptionId, gracePeriodEndsAt) {
  await pool.query("UPDATE tenant_subscriptions SET status = 'grace_period', grace_period_ends_at = ? WHERE id = ?", [gracePeriodEndsAt, subscriptionId]);
  return findById(subscriptionId);
}

export async function transitionToExpired(subscriptionId) {
  await pool.query("UPDATE tenant_subscriptions SET status = 'expired' WHERE id = ?", [subscriptionId]);
  return findById(subscriptionId);
}

// --- Cron scan queries (subscriptionLifecycleJob.js) — each is one bounded,
// index-backed query, never a per-tenant loop. ---

export async function findDueForScheduledChange() {
  const [rows] = await pool.query(
    'SELECT * FROM tenant_subscriptions WHERE scheduled_effective_date IS NOT NULL AND scheduled_effective_date <= NOW()',
  );
  return rows;
}

export async function findPastEndDate() {
  const [rows] = await pool.query(
    "SELECT * FROM tenant_subscriptions WHERE status IN ('active','trial') AND end_date IS NOT NULL AND end_date <= NOW()",
  );
  return rows;
}

export async function findPastGracePeriod() {
  const [rows] = await pool.query(
    "SELECT * FROM tenant_subscriptions WHERE status = 'grace_period' AND grace_period_ends_at IS NOT NULL AND grace_period_ends_at <= NOW()",
  );
  return rows;
}

// Notification-sweep support — each embeds its own NOT EXISTS dedupe guard
// against `notifications`, mirroring platformTenant.repository.js's
// findRecentlyRegisteredUnnotified()/findTrialsExpiringSoonUnnotified()
// pattern exactly, so the job never fires the same notification twice.
export async function findExpiringSoonUnnotified(withinDays) {
  const [rows] = await pool.query(
    `SELECT ts.*, t.company_name FROM tenant_subscriptions ts JOIN tenants t ON t.id = ts.tenant_id
     WHERE ts.status IN ('active','trial') AND ts.end_date IS NOT NULL
       AND ts.end_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reference_type = 'tenant_subscription' AND n.reference_id = ts.id
           AND n.category IN ('trial_ending','subscription_expiring') AND n.created_at >= ts.updated_at
       )`,
    [withinDays],
  );
  return rows;
}

export async function findJustExpiredUnnotified() {
  const [rows] = await pool.query(
    `SELECT ts.*, t.company_name FROM tenant_subscriptions ts JOIN tenants t ON t.id = ts.tenant_id
     WHERE ts.status = 'expired'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reference_type = 'tenant_subscription' AND n.reference_id = ts.id
           AND n.category = 'subscription_expired' AND n.created_at >= ts.updated_at
       )`,
  );
  return rows;
}

// --- Billing dashboard KPI aggregates (platformDashboard.service.js's
// getBillingKpis()) — one GROUP BY / CASE-summed query each, never a
// per-tile loop, per Step 13's explicit performance requirement. ---

export async function getStatusCounts() {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS total FROM tenant_subscriptions GROUP BY status');
  const counts = { trial: 0, active: 0, expired: 0, suspended: 0, cancelled: 0, pending_payment: 0, grace_period: 0 };
  for (const row of rows) counts[row.status] = Number(row.total);
  return counts;
}

export async function getExpiringSoonCount(withinDays = 7) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total FROM tenant_subscriptions
     WHERE status IN ('active','trial') AND end_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)`,
    [withinDays],
  );
  return Number(row.total) || 0;
}

export async function getTrialConversionCount(sinceDays = 30) {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS total FROM tenant_subscriptions WHERE trial_converted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)',
    [sinceDays],
  );
  return Number(row.total) || 0;
}

export async function getMostPopularPlan() {
  const [[row]] = await pool.query(
    `SELECT p.id, p.name, COUNT(*) AS total
     FROM tenant_subscriptions ts JOIN subscription_plans p ON p.id = ts.plan_id
     WHERE ts.status IN ('active','trial','grace_period')
     GROUP BY p.id, p.name
     ORDER BY total DESC
     LIMIT 1`,
  );
  return row ? { planId: row.id, planName: row.name, subscriberCount: Number(row.total) } : null;
}

// One query, one CASE-based SUM, normalized to a monthly-equivalent
// (divide quarterly by 3, yearly by 12) — projected, not collected, since
// there's no payment ledger this phase. Annual projection is simply this
// figure x12, computed in the service layer rather than a second query
// (avoids the duplicate-calculation Step 13 explicitly warns against).
export async function getMonthlyRevenueProjected() {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(
       CASE ts.billing_cycle
         WHEN 'monthly' THEN p.price_monthly
         WHEN 'quarterly' THEN p.price_quarterly / 3
         WHEN 'yearly' THEN p.price_yearly / 12
       END
     ), 0) AS monthlyRevenue
     FROM tenant_subscriptions ts JOIN subscription_plans p ON p.id = ts.plan_id
     WHERE ts.status IN ('active', 'grace_period')`,
  );
  return Number(row.monthlyRevenue) || 0;
}
