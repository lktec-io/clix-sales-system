import * as tenantRepository from '../repositories/tenant.repository.js';
import * as moduleRepository from '../repositories/module.repository.js';
import * as templateModuleRepository from '../repositories/templateModule.repository.js';
import * as tenantModuleRepository from '../repositories/tenantModule.repository.js';

// Mirrors backend/middlewares/authorize.js's permission cache and
// backend/middlewares/tenantContext.js's tenant cache exactly — same TTL,
// same in-process Map-per-process shape, same explicit invalidate-on-write
// convention. This is the single hottest new code path Phase 5 adds (read
// by requireModule() on every gated request, and by the tenant-facing
// GET /modules/me endpoint), so it gets the same treatment those two
// already-proven caches get rather than a new caching strategy.
const CACHE_TTL_MS = 60_000;
const tenantModulesCache = new Map(); // tenantId -> { value: Module[], expiresAt }
const registryCache = new Map(); // 'all' -> { value: Module[], expiresAt }

async function getActiveRegistry() {
  const cached = registryCache.get('all');
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const modules = await moduleRepository.findAllActive();
  registryCache.set('all', { value: modules, expiresAt: Date.now() + CACHE_TTL_MS });
  return modules;
}

// Precedence: is_core modules are always enabled (never gated); otherwise a
// tenant_modules override wins if one exists; otherwise fall back to the
// tenant's business template's setting; anything not covered by either
// resolves to disabled (safe default-deny — matches the migration's own
// "absence of a row means disabled" convention).
//
// Ordering: a module's position is its global `navigation_order` UNLESS the
// tenant's template has set a `sort_order_override` for it in
// template_modules (NULL by default for every template). This is what lets
// one template reorder its own nav (e.g. Pharmacy putting Sales before
// Medicines) without moving a shared module like Customers/Suppliers for
// every other template that reuses it — those keep the exact global order
// they've always had since their template_modules rows have no override.
export async function resolveEnabledModulesForTenant(tenantId) {
  const cached = tenantModulesCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [tenant, registry] = await Promise.all([tenantRepository.findById(tenantId), getActiveRegistry()]);

  const [templateModules, overrides] = await Promise.all([
    templateModuleRepository.findEnabledModulesForTemplate(tenant.business_template_id),
    tenantModuleRepository.findOverridesForTenant(tenantId),
  ]);

  const templateEnabledSet = new Set(templateModules.map((row) => row.key));
  const sortOverrideByKey = new Map(templateModules.map((row) => [row.key, row.sort_order_override]));
  const overrideMap = new Map(overrides.map((row) => [row.key, Boolean(row.is_enabled)]));

  const resolved = registry
    .filter((module) => {
      if (module.is_core) return true;
      if (overrideMap.has(module.key)) return overrideMap.get(module.key);
      return templateEnabledSet.has(module.key);
    })
    .map((module) => {
      const sortOverride = sortOverrideByKey.get(module.key);
      return sortOverride == null ? module : { ...module, navigation_order: sortOverride };
    })
    .sort((a, b) => a.navigation_order - b.navigation_order || a.id - b.id);

  tenantModulesCache.set(tenantId, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
  return resolved;
}

export async function isModuleEnabledForTenant(tenantId, moduleKey) {
  const modules = await resolveEnabledModulesForTenant(tenantId);
  return modules.some((module) => module.key === moduleKey);
}

export function invalidateTenantModulesCache(tenantId) {
  if (tenantId) tenantModulesCache.delete(tenantId);
  else tenantModulesCache.clear();
}

// A registry-wide change (a module's is_active flag, or any module CRUD)
// can affect every tenant's resolved set, not just one — clears both caches.
export function invalidateModuleRegistryCache() {
  registryCache.clear();
  tenantModulesCache.clear();
}
