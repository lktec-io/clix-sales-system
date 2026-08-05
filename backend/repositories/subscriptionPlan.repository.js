import { pool } from '../config/db.js';

export async function findAllActive() {
  const [rows] = await pool.query(
    'SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC',
  );
  return rows;
}

export async function findAllForAdmin() {
  const [rows] = await pool.query('SELECT * FROM subscription_plans ORDER BY sort_order ASC, id ASC');
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM subscription_plans WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findBySlug(slug) {
  const [rows] = await pool.query('SELECT * FROM subscription_plans WHERE slug = ? LIMIT 1', [slug]);
  return rows[0] || null;
}

export async function create({ name, slug, description, priceMonthly, priceQuarterly, priceYearly, currency, features, isRecommended, sortOrder }) {
  const [result] = await pool.query(
    `INSERT INTO subscription_plans (name, slug, description, price_monthly, price_quarterly, price_yearly, currency, features, is_recommended, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, slug, description || null, priceMonthly, priceQuarterly, priceYearly, currency || 'TZS',
      features ? JSON.stringify(features) : null, Boolean(isRecommended), sortOrder || 0,
    ],
  );
  return findById(result.insertId);
}

// Never touches is_active/sort_order/is_recommended — those have their own
// single-purpose setters below (Step 2 lists them as distinct admin
// actions: Deactivate/Activate, Reorder, Mark recommended, separate from
// "Update Plan"/"Change pricing").
export async function update(id, { name, slug, description, priceMonthly, priceQuarterly, priceYearly, currency, features }) {
  await pool.query(
    `UPDATE subscription_plans
     SET name = ?, slug = ?, description = ?, price_monthly = ?, price_quarterly = ?, price_yearly = ?, currency = ?, features = ?
     WHERE id = ?`,
    [name, slug, description || null, priceMonthly, priceQuarterly, priceYearly, currency || 'TZS', features ? JSON.stringify(features) : null, id],
  );
  return findById(id);
}

export async function setActive(id, isActive) {
  await pool.query('UPDATE subscription_plans SET is_active = ? WHERE id = ?', [Boolean(isActive), id]);
  return findById(id);
}

// Clears every other plan's flag first so at most one plan is ever
// recommended — enforced here in the service/repository layer rather than a
// DB constraint, since MySQL has no cheap portable "at most one TRUE" check
// across a handful of rows.
export async function setRecommended(id) {
  await pool.query('UPDATE subscription_plans SET is_recommended = FALSE WHERE id <> ?', [id]);
  await pool.query('UPDATE subscription_plans SET is_recommended = TRUE WHERE id = ?', [id]);
  return findById(id);
}

// Plan count is always small (3, extensible to a handful more) — a loop of
// single-row UPDATEs is simpler and clearer than a bulk CASE-WHEN statement
// here, and correctness matters far more than shaving a few round trips on
// a table this size.
export async function reorder(orderedIds) {
  await Promise.all(orderedIds.map((id, index) => pool.query('UPDATE subscription_plans SET sort_order = ? WHERE id = ?', [index, id])));
  return findAllForAdmin();
}
