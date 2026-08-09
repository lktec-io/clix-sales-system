import { ApiError } from '../utils/apiError.js';
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
export async function assignTemplate(tenantId, businessTemplateId) {
  await businessTemplateRepository.assignToTenant(tenantId, businessTemplateId);
  await copyDefaultSettingsToTenant(tenantId, businessTemplateId);
  invalidateTenantModulesCache(tenantId);
}

// One-time seed, not a live link — template_default_settings rows are
// copied into the tenant's OWN system_settings at assignment time only, so
// a tenant's later customization is never overwritten by a future edit to
// the template's defaults (mirrors how company_settings is a one-time-
// seeded, tenant-owned row today).
async function copyDefaultSettingsToTenant(tenantId, businessTemplateId) {
  const defaults = await templateSettingsRepository.findAll(businessTemplateId);
  for (const setting of defaults) {
    await systemSettingsRepository.upsert(tenantId, setting.setting_key, setting.setting_value, setting.data_type, null);
  }
}
