import { pool } from '../config/db.js';

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findByCompanyCode(companyCode, connection = pool) {
  const [rows] = await connection.query('SELECT id FROM tenants WHERE company_code = ? LIMIT 1', [companyCode]);
  return rows[0] || null;
}

export async function create({ companyName, companyCode, subscriptionStatus, trialStartedAt, trialEndsAt }, connection = pool) {
  const [result] = await connection.query(
    `INSERT INTO tenants (company_name, company_code, status, subscription_status, trial_started_at, trial_ends_at)
     VALUES (?, ?, 'active', ?, ?, ?)`,
    [companyName, companyCode, subscriptionStatus, trialStartedAt, trialEndsAt],
  );
  const [rows] = await connection.query('SELECT * FROM tenants WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0];
}

// Cron-only (backend/jobs/trialExpiryJob.js) — flips a tenant's stored
// subscription_status once its trial window has actually passed. The live
// per-request check in requireActiveTrial.js already enforces expiry
// instantly off trial_ends_at; this just keeps the stored column truthful
// for anything that reads it directly (the Trial Card, future admin
// tooling) instead of letting it silently drift.
export async function expireOverdueTrials() {
  const [result] = await pool.query(
    "UPDATE tenants SET subscription_status = 'expired' WHERE subscription_status = 'trial' AND trial_ends_at <= NOW()",
  );
  return result.affectedRows;
}
