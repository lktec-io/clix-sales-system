import { pool } from '../config/db.js';

export async function findAllActive() {
  const [rows] = await pool.query('SELECT * FROM modules WHERE is_active = TRUE ORDER BY navigation_order ASC, id ASC');
  return rows;
}

export async function findAllForAdmin() {
  const [rows] = await pool.query('SELECT * FROM modules ORDER BY navigation_order ASC, id ASC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM modules WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findByKey(key) {
  const [rows] = await pool.query('SELECT * FROM modules WHERE `key` = ? LIMIT 1', [key]);
  return rows[0] || null;
}

export async function create({ key, name, icon, route, requiredPermission, navigationOrder, dashboardWidgets, dependencies, isCore }) {
  const [result] = await pool.query(
    `INSERT INTO modules (\`key\`, name, icon, route, required_permission, navigation_order, dashboard_widgets, dependencies, is_core)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      key, name, icon || null, route || null, requiredPermission || null, navigationOrder || 0,
      dashboardWidgets ? JSON.stringify(dashboardWidgets) : null, dependencies ? JSON.stringify(dependencies) : null, Boolean(isCore),
    ],
  );
  return findById(result.insertId);
}

export async function update(id, { name, icon, route, requiredPermission, navigationOrder, dashboardWidgets, dependencies }) {
  await pool.query(
    `UPDATE modules
     SET name = ?, icon = ?, route = ?, required_permission = ?, navigation_order = ?, dashboard_widgets = ?, dependencies = ?
     WHERE id = ?`,
    [
      name, icon || null, route || null, requiredPermission || null, navigationOrder || 0,
      dashboardWidgets ? JSON.stringify(dashboardWidgets) : null, dependencies ? JSON.stringify(dependencies) : null, id,
    ],
  );
  return findById(id);
}

export async function setActive(id, isActive) {
  await pool.query('UPDATE modules SET is_active = ? WHERE id = ?', [Boolean(isActive), id]);
  return findById(id);
}
