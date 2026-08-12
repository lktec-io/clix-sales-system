import { pool } from '../config/db.js';

export async function create({ tenantId, repairId, category, recipientPhone, message, provider, status, providerResponse, sentBy }) {
  const [result] = await pool.query(
    `INSERT INTO sms_logs (tenant_id, repair_id, category, recipient_phone, message, provider, status, provider_response, sent_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, repairId || null, category, recipientPhone, message, provider, status, providerResponse || null, sentBy || null],
  );
  return result.insertId;
}

export async function countSentSince(tenantId, sinceDate) {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS total FROM sms_logs WHERE tenant_id = ? AND status = 'sent' AND created_at >= ?",
    [tenantId, sinceDate],
  );
  return Number(row?.total || 0);
}

export async function findForRepair(tenantId, repairId) {
  const [rows] = await pool.query(
    'SELECT * FROM sms_logs WHERE tenant_id = ? AND repair_id = ? ORDER BY created_at DESC',
    [tenantId, repairId],
  );
  return rows;
}
