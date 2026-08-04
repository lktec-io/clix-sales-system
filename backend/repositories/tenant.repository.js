import { pool } from '../config/db.js';

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}
