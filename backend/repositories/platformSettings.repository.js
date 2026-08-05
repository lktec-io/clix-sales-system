import { pool } from '../config/db.js';

export async function findAll() {
  const [rows] = await pool.query('SELECT setting_key, setting_value, data_type FROM platform_settings');
  return rows;
}

export async function upsert(key, value, dataType, platformAdminId) {
  await pool.query(
    `INSERT INTO platform_settings (setting_key, setting_value, data_type, updated_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), data_type = VALUES(data_type), updated_by = VALUES(updated_by)`,
    [key, value, dataType, platformAdminId],
  );
}
