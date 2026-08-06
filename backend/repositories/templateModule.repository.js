import { pool } from '../config/db.js';

// LEFT JOIN so every module in the registry appears in the admin's
// checklist view, even one this template has never configured (absence =
// disabled, per the migration's own "safe default-deny" comment).
export async function findForTemplate(templateId) {
  const [rows] = await pool.query(
    `SELECT m.id AS module_id, m.\`key\`, m.name, m.is_core, m.is_active,
            COALESCE(tm.is_enabled, FALSE) AS is_enabled, tm.sort_order_override
     FROM modules m
     LEFT JOIN template_modules tm ON tm.module_id = m.id AND tm.business_template_id = ?
     ORDER BY m.navigation_order ASC, m.id ASC`,
    [templateId],
  );
  return rows;
}

// Used only by the resolver — enabled, non-core, currently-active module
// keys for a template. Core modules are handled separately by the resolver
// itself (always enabled, never read from this table).
export async function findEnabledModuleKeysForTemplate(templateId) {
  const [rows] = await pool.query(
    `SELECT m.\`key\`
     FROM template_modules tm
     JOIN modules m ON m.id = tm.module_id
     WHERE tm.business_template_id = ? AND tm.is_enabled = TRUE AND m.is_active = TRUE`,
    [templateId],
  );
  return rows.map((row) => row.key);
}

export async function setEnabled(templateId, moduleId, isEnabled) {
  await pool.query(
    `INSERT INTO template_modules (business_template_id, module_id, is_enabled)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled)`,
    [templateId, moduleId, Boolean(isEnabled)],
  );
  return findForTemplate(templateId);
}

// One upsert per entry — the module list per template is small (≤29 rows),
// so a loop of single-row upserts is simpler and clearer than a bulk
// multi-row statement here, same reasoning subscriptionPlan.repository.js's
// reorder() already applied.
export async function bulkSetEnabled(templateId, moduleSettings) {
  await Promise.all(moduleSettings.map(({ moduleId, isEnabled }) => pool.query(
    `INSERT INTO template_modules (business_template_id, module_id, is_enabled)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled)`,
    [templateId, moduleId, Boolean(isEnabled)],
  )));
  return findForTemplate(templateId);
}
