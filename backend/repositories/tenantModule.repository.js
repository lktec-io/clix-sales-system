import { pool } from '../config/db.js';

// LEFT JOIN against the tenant's own overrides so the admin's per-tenant
// checklist can show "inherited from template" vs "explicitly overridden"
// — tm.is_enabled (template default) alongside tov.is_enabled (override,
// NULL if none exists).
export async function findForTenant(tenantId, templateId) {
  const [rows] = await pool.query(
    `SELECT m.id AS module_id, m.\`key\`, m.name, m.is_core, m.is_active,
            COALESCE(tm.is_enabled, FALSE) AS template_enabled,
            tov.is_enabled AS override_enabled
     FROM modules m
     LEFT JOIN template_modules tm ON tm.module_id = m.id AND tm.business_template_id = ?
     LEFT JOIN tenant_modules tov ON tov.module_id = m.id AND tov.tenant_id = ?
     ORDER BY m.navigation_order ASC, m.id ASC`,
    [templateId, tenantId],
  );
  return rows;
}

// Used only by the resolver — module keys this tenant has an explicit
// override for, keyed to whether that override enables or disables them.
export async function findOverridesForTenant(tenantId) {
  const [rows] = await pool.query(
    `SELECT m.\`key\`, tov.is_enabled
     FROM tenant_modules tov
     JOIN modules m ON m.id = tov.module_id
     WHERE tov.tenant_id = ?`,
    [tenantId],
  );
  return rows;
}

export async function setOverride(tenantId, moduleId, isEnabled) {
  await pool.query(
    `INSERT INTO tenant_modules (tenant_id, module_id, is_enabled)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled)`,
    [tenantId, moduleId, Boolean(isEnabled)],
  );
}

// Removes the override, reverting the tenant back to the template's
// default for that module — a distinct action from "override to enabled",
// not the same as setOverride(tenantId, moduleId, true).
export async function clearOverride(tenantId, moduleId) {
  await pool.query('DELETE FROM tenant_modules WHERE tenant_id = ? AND module_id = ?', [tenantId, moduleId]);
}
