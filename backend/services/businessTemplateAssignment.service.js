import { ApiError } from '../utils/apiError.js';
import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';
import * as businessTemplateRepository from '../repositories/businessTemplate.repository.js';
import * as templateSettingsRepository from '../repositories/templateSettings.repository.js';
import * as systemSettingsRepository from '../repositories/systemSettings.repository.js';
import { invalidateTenantModulesCache } from './moduleResolution.service.js';

const DEFAULT_TEMPLATE_ID = 1; // Retail Store — see 026_create_module_framework_tables.sql's deterministic seed id.

// Called additively from tenant.controller.js right after
// tenantService.register() resolves — tenant.service.js/tenant.repository
// .js are never touched. Best-effort, same as register()'s own post-commit
// welcome email/activity log: the registration transaction itself has
// already committed by the time this runs.
export async function assignDefault(tenantId) {
  return assignTemplate(tenantId, DEFAULT_TEMPLATE_ID);
}

// Phase 5.2 — validates a signup form's optional businessTemplateId BEFORE
// tenant.service.js's registration transaction ever runs (called from
// tenant.controller.js, not from inside the transaction), so a bad
// selection is rejected with zero side effects — no half-created tenant,
// no account a rejected request could still log into. No template supplied
// -&gt; silently falls back to Retail Store, preserving the exact pre-Phase-
// 5.2 default behavior. A template supplied but missing/inactive/archived
// -&gt; explicit 400, never a silent fallback (the user asked for something
// specific; guessing on their behalf would be surprising).
export async function resolveSelectedTemplateId(businessTemplateId) {
  if (!businessTemplateId) return DEFAULT_TEMPLATE_ID;

  const template = await businessTemplateRepository.findById(businessTemplateId);
  if (!template || template.status !== 'active') {
    throw new ApiError(400, 'Selected business type is not available. Please choose another.');
  }
  return template.id;
}

// Also the platform-admin reassignment path (platformTenant.service.js's
// new setBusinessTemplate action calls this directly).
//
// Runs both writes (the tenants.business_template_id column and the
// system_settings defaults it seeds) as one transaction, then reads the
// column back to confirm it actually persisted. tenant.service.js's own
// registration transaction can't include this write (tenant.service.js/
// tenant.repository.js are off-limits — the template selection isn't known
// until after that transaction already has to run), so this can't be made
// truly atomic WITH tenant creation. What it can guarantee is that it never
// reports success while silently leaving the tenant on the schema default:
// either both writes land and the readback proves it, or the whole thing
// throws and the caller (tenant.controller.js) sees a real error to log/retry
// on, instead of a partial write nobody notices.
export async function assignTemplate(tenantId, businessTemplateId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await businessTemplateRepository.assignToTenant(tenantId, businessTemplateId, connection);
    await copyDefaultSettingsToTenant(tenantId, businessTemplateId, connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const confirmed = await businessTemplateRepository.findTenantTemplateId(tenantId);
  if (confirmed !== businessTemplateId) {
    throw new Error(`Business template assignment did not persist for tenant ${tenantId}: expected ${businessTemplateId}, found ${confirmed}`);
  }

  // Temporary diagnostic — confirms this exact write+verify path executed
  // and what it persisted. Safe to remove once production is confirmed
  // to be running this code and assigning correctly.
  logger.info('Registration: business template assigned and verified', { tenantId, businessTemplateId: confirmed });

  invalidateTenantModulesCache(tenantId);
}

// One-time seed, not a live link — template_default_settings rows are
// copied into the tenant's OWN system_settings at assignment time only, so
// a tenant's later customization is never overwritten by a future edit to
// the template's defaults (mirrors how company_settings is a one-time-
// seeded, tenant-owned row today).
async function copyDefaultSettingsToTenant(tenantId, businessTemplateId, connection) {
  const defaults = await templateSettingsRepository.findAll(businessTemplateId);
  for (const setting of defaults) {
    await systemSettingsRepository.upsert(tenantId, setting.setting_key, setting.setting_value, setting.data_type, null, connection);
  }
}
