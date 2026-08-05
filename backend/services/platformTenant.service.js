import { ApiError } from '../utils/apiError.js';
import { invalidateTenantCache } from '../middlewares/tenantContext.js';
import * as platformTenantRepository from '../repositories/platformTenant.repository.js';
import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';
import * as platformNotificationRepository from '../repositories/platformNotification.repository.js';
import * as platformSettingsService from './platformSettings.service.js';

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
