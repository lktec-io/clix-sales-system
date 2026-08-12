import { ApiError } from '../utils/apiError.js';
import { invalidateTenantCache } from '../middlewares/tenantContext.js';
import * as platformTenantRepository from '../repositories/platformTenant.repository.js';
import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';
import * as platformNotificationRepository from '../repositories/platformNotification.repository.js';
import * as platformSettingsService from './platformSettings.service.js';
import * as businessTemplateRepository from '../repositories/businessTemplate.repository.js';
import * as businessTemplateAssignmentService from './businessTemplateAssignment.service.js';
import * as tenantModuleRepository from '../repositories/tenantModule.repository.js';
import { invalidateTenantModulesCache } from './moduleResolution.service.js';

async function findOwnedTenant(id) {
  const tenant = await platformTenantRepository.findById(id);
  if (!tenant) throw new ApiError(404, 'Tenant not found');
  return tenant;
}

export async function listTenants(query) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await platformTenantRepository.findAll({
    page,
    limit,
    search: query.search,
    status: query.status,
    subscriptionStatus: query.subscriptionStatus,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getTenantDetail(tenantId) {
  const tenant = await findOwnedTenant(tenantId);

  const [company, owner, userCount, branchCount, branches, recentLogins] = await Promise.all([
    platformTenantRepository.getCompanyInfo(tenantId),
    platformTenantRepository.getOwner(tenantId),
    platformTenantRepository.countUsers(tenantId),
    platformTenantRepository.countBranches(tenantId),
    platformTenantRepository.listBranches(tenantId),
    platformTenantRepository.getRecentLogins(tenantId, 10),
  ]);

  return { tenant, company, owner, userCount, branchCount, branches, recentLogins };
}

export async function listTenantUsers(tenantId, query) {
  await findOwnedTenant(tenantId);
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await platformTenantRepository.listUsers(tenantId, { page, limit });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// Every action below: mutate -> invalidate the tenant-resolution cache
// (tenantContext.js's already-exported invalidateTenantCache, imported —
// not modified) so the change is live on the tenant's very next request,
// not after waiting out the 60s cache -> write one platform_audit_logs row.
async function logAction(platformAdminId, action, description, tenantId, ipAddress) {
  await platformAuditLogRepository.create({ platformAdminId, action, description, tenantId, ipAddress });
}

export async function suspendTenant(tenantId, admin, ipAddress, reason) {
  const tenant = await findOwnedTenant(tenantId);
  const updated = await platformTenantRepository.suspend(tenantId);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.suspend', `Suspended "${tenant.company_name}"${reason ? ` — ${reason}` : ''}`, tenantId, ipAddress);
  await platformNotificationRepository.fanOutToAllAdmins({
    type: 'warning',
    category: 'tenant_suspended',
    title: 'Tenant suspended',
    message: `"${tenant.company_name}" was suspended by ${admin.firstName} ${admin.lastName}.`,
    tenantId,
  });
  return updated;
}

export async function activateTenant(tenantId, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  const updated = await platformTenantRepository.activate(tenantId);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.activate', `Activated "${tenant.company_name}"`, tenantId, ipAddress);
  return updated;
}

// See 036_add_deleted_tenant_status.sql — a status flip, not a real
// DELETE. `confirmCompanyName` must match the tenant's actual company name
// exactly: the UI already gates this behind a type-to-confirm field, but
// enforcing it here too means the API itself can't be casually called
// (direct request, script, typo) without the caller actually knowing which
// tenant they're deleting — the same "you must prove you meant this"
// property a client-side-only check can't guarantee. Immediately blocks
// all access for every user of this tenant via the exact same
// resolveTenant() `status !== 'active'` check 'suspended' already relies
// on — no new enforcement code path.
export async function deleteTenant(tenantId, confirmCompanyName, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  if (tenant.status === 'deleted') throw new ApiError(400, 'Tenant is already deleted');
  if (confirmCompanyName !== tenant.company_name) {
    throw new ApiError(400, 'Company name confirmation does not match.');
  }

  const { affected, tenant: updated } = await platformTenantRepository.softDelete(tenantId);
  if (!affected) throw new ApiError(409, 'Tenant could not be deleted — it may have already changed status.');

  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.delete', `Deleted "${tenant.company_name}" (all data retained; account permanently deactivated)`, tenantId, ipAddress);
  await platformNotificationRepository.fanOutToAllAdmins({
    type: 'danger',
    category: 'tenant_deleted',
    title: 'Tenant deleted',
    message: `"${tenant.company_name}" was deleted by ${admin.firstName} ${admin.lastName}.`,
    tenantId,
  });
  return updated;
}

// Reverses an accidental/mistaken deletion. Deliberately not exposed next
// to Activate for a normal 'suspended' tenant — only ever shown for a
// 'deleted' one — so it can never be confused with routine
// suspend/activate. All the tenant's underlying data was never touched by
// deleteTenant() above, so restoring is a clean, complete undo.
export async function restoreTenant(tenantId, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  if (tenant.status !== 'deleted') throw new ApiError(400, 'Tenant is not deleted');

  const updated = await platformTenantRepository.restore(tenantId);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.restore', `Restored "${tenant.company_name}" from deleted`, tenantId, ipAddress);
  return updated;
}

export async function extendTrial(tenantId, days, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  const updated = await platformTenantRepository.extendTrial(tenantId, days);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.extend_trial', `Extended trial for "${tenant.company_name}" by ${days} day(s)`, tenantId, ipAddress);
  return updated;
}

export async function reduceTrial(tenantId, days, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  const updated = await platformTenantRepository.reduceTrial(tenantId, days);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.reduce_trial', `Reduced trial for "${tenant.company_name}" by ${days} day(s)`, tenantId, ipAddress);
  return updated;
}

export async function resetTrial(tenantId, days, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  const resolvedDays = days || await platformSettingsService.getTrialDurationDefaultDays();
  const updated = await platformTenantRepository.resetTrial(tenantId, resolvedDays);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.reset_trial', `Reset trial for "${tenant.company_name}" to ${resolvedDays} day(s)`, tenantId, ipAddress);
  return updated;
}

export async function activateSubscriptionManually(tenantId, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  const updated = await platformTenantRepository.activateSubscriptionManually(tenantId);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.activate_subscription', `Manually activated subscription for "${tenant.company_name}"`, tenantId, ipAddress);
  return updated;
}

export async function expireImmediately(tenantId, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  const updated = await platformTenantRepository.expireImmediately(tenantId);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.expire_trial', `Expired trial immediately for "${tenant.company_name}"`, tenantId, ipAddress);
  return updated;
}

// Phase 5 — Business Templates & Dynamic Module Framework. Reassigns a
// tenant's template (Step 4/8/9's "assign template" action). Delegates the
// actual write + default-settings copy + module-resolution cache
// invalidation to businessTemplateAssignmentService (the same function
// self-registration's default-assignment uses) rather than duplicating
// that logic here — this function only adds the platform-admin-specific
// concerns: ownership check, tenant-row cache invalidation, audit log.
export async function setBusinessTemplate(tenantId, businessTemplateId, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  const template = await businessTemplateRepository.findById(businessTemplateId);
  if (!template) throw new ApiError(404, 'Business template not found');

  await businessTemplateAssignmentService.assignTemplate(tenantId, businessTemplateId);
  invalidateTenantCache(tenantId);
  await logAction(admin.id, 'tenant.set_business_template', `Moved "${tenant.company_name}" to the "${template.name}" template`, tenantId, ipAddress);

  return platformTenantRepository.findById(tenantId);
}

// Per-tenant module override checklist (Step 8: "Override modules for a
// single tenant") — a row here wins over the tenant's template's own
// setting; clearing it (isEnabled === null) reverts to the template
// default. Scoped to exactly this tenant, so it can never affect any
// other tenant on the same template (tenant isolation preserved).
export async function getModuleOverrides(tenantId) {
  await findOwnedTenant(tenantId);
  const tenant = await platformTenantRepository.findById(tenantId);
  return tenantModuleRepository.findForTenant(tenantId, tenant.business_template_id);
}

export async function setModuleOverride(tenantId, moduleId, isEnabled, admin, ipAddress) {
  const tenant = await findOwnedTenant(tenantId);
  if (isEnabled === null) {
    await tenantModuleRepository.clearOverride(tenantId, moduleId);
  } else {
    await tenantModuleRepository.setOverride(tenantId, moduleId, isEnabled);
  }
  invalidateTenantModulesCache(tenantId);
  await logAction(
    admin.id, 'tenant.set_module_override',
    `${isEnabled === null ? 'Cleared' : isEnabled ? 'Enabled' : 'Disabled'} a module override for "${tenant.company_name}"`,
    tenantId, ipAddress,
  );
  return getModuleOverrides(tenantId);
}
