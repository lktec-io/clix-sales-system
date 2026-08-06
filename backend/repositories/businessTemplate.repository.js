import { pool } from '../config/db.js';

export async function findAllActive() {
  const [rows] = await pool.query("SELECT * FROM business_templates WHERE status = 'active' ORDER BY name ASC");
  return rows;
}

export async function findAllForAdmin() {
  const [rows] = await pool.query('SELECT * FROM business_templates ORDER BY name ASC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM business_templates WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findBySlug(slug) {
  const [rows] = await pool.query('SELECT * FROM business_templates WHERE slug = ? LIMIT 1', [slug]);
  return rows[0] || null;
}

export async function create({ name, slug, description }) {
  const [result] = await pool.query(
    'INSERT INTO business_templates (name, slug, description) VALUES (?, ?, ?)',
    [name, slug, description || null],
  );
  return findById(result.insertId);
}

export async function update(id, { name, slug, description }) {
  await pool.query('UPDATE business_templates SET name = ?, slug = ?, description = ? WHERE id = ?', [name, slug, description || null, id]);
  return findById(id);
}

export async function setStatus(id, status) {
  await pool.query('UPDATE business_templates SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

// The only write this file makes to `tenants` — a single-column UPDATE,
// same shape as every other tenant-mutating action in this codebase
// (platformTenant.repository.js's suspend/activate/etc). tenant.repository
// .js itself is never touched.
export async function assignToTenant(tenantId, businessTemplateId) {
  await pool.query('UPDATE tenants SET business_template_id = ? WHERE id = ?', [businessTemplateId, tenantId]);
}

// Clones a template's own row plus its module map and default settings —
// never its tenants (a duplicate starts with zero tenants assigned).
export async function duplicate(sourceId, { name, slug }, connection = pool) {
  const [result] = await connection.query(
    `INSERT INTO business_templates (name, slug, description, status)
     SELECT ?, ?, description, 'active' FROM business_templates WHERE id = ?`,
    [name, slug, sourceId],
  );
  const newId = result.insertId;

  await connection.query(
    `INSERT INTO template_modules (business_template_id, module_id, is_enabled, sort_order_override)
     SELECT ?, module_id, is_enabled, sort_order_override FROM template_modules WHERE business_template_id = ?`,
    [newId, sourceId],
  );
  await connection.query(
    `INSERT INTO template_default_settings (business_template_id, setting_key, setting_value, data_type)
     SELECT ?, setting_key, setting_value, data_type FROM template_default_settings WHERE business_template_id = ?`,
    [newId, sourceId],
  );

  return findById(newId);
}
