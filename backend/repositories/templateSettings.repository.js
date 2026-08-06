import { pool } from '../config/db.js';

export async function findAll(templateId) {
  const [rows] = await pool.query('SELECT * FROM template_default_settings WHERE business_template_id = ?', [templateId]);
  return rows;
}

export async function upsert(templateId, key, value, dataType) {
  await pool.query(
    `INSERT INTO template_default_settings (business_template_id, setting_key, setting_value, data_type)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), data_type = VALUES(data_type)`,
    [templateId, key, value, dataType],
  );
  return findAll(templateId);
}
