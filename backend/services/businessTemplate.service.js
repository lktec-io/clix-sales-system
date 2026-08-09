import { ApiError } from '../utils/apiError.js';
import { pool } from '../config/db.js';
import * as businessTemplateRepository from '../repositories/businessTemplate.repository.js';
import * as templateModuleRepository from '../repositories/templateModule.repository.js';
import * as templateSettingsRepository from '../repositories/templateSettings.repository.js';
import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';
import { invalidateModuleRegistryCache } from './moduleResolution.service.js';

async function findOwnedTemplate(id) {
  const template = await businessTemplateRepository.findById(id);
  if (!template) throw new ApiError(404, 'Business template not found');
  return template;
}

async function logAction(platformAdminId, action, description, ipAddress) {
  await platformAuditLogRepository.create({ platformAdminId, action, description, tenantId: null, ipAddress });
}

export async function listForAdmin() {
  return businessTemplateRepository.findAllForAdmin();
}

// Used by the tenant-reassignment dropdown in TenantDetail.jsx — only
// templates a platform admin should offer as a live option (not archived).
export async function listActive() {
  return businessTemplateRepository.findAllActive();
}

// Phase 5.2 — the public signup template picker (Register.jsx). Reshaped
// and stripped of admin-only fields (status/timestamps), mirroring
// subscriptionPlan.service.js's listPublicPlans() precedent exactly — same
// "active-only, reshaped for an unauthenticated caller" pattern.
export async function listPublicTemplates() {
  const templates = await businessTemplateRepository.findAllActive();
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
  }));
}

export async function getDetail(id) {
  const template = await findOwnedTemplate(id);
  const [modules, settings] = await Promise.all([
    templateModuleRepository.findForTemplate(id),
    templateSettingsRepository.findAll(id),
  ]);
  return { template, modules, settings };
}

export async function createTemplate(data, admin, ipAddress) {
  const existing = await businessTemplateRepository.findBySlug(data.slug);
  if (existing) throw new ApiError(409, 'A template with this slug already exists');

  const template = await businessTemplateRepository.create(data);
  await logAction(admin.id, 'template.create', `Created template "${template.name}"`, ipAddress);
  return template;
}

export async function updateTemplate(id, data, admin, ipAddress) {
  await findOwnedTemplate(id);
  const template = await businessTemplateRepository.update(id, data);
  await logAction(admin.id, 'template.update', `Renamed/updated template "${template.name}"`, ipAddress);
  return template;
}

export async function duplicateTemplate(id, { name, slug }, admin, ipAddress) {
  const source = await findOwnedTemplate(id);
  const existing = await businessTemplateRepository.findBySlug(slug);
  if (existing) throw new ApiError(409, 'A template with this slug already exists');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const duplicated = await businessTemplateRepository.duplicate(id, { name, slug }, connection);
    await connection.commit();
    await logAction(admin.id, 'template.duplicate', `Duplicated "${source.name}" as "${duplicated.name}"`, ipAddress);
    return duplicated;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function activateTemplate(id, admin, ipAddress) {
  const template = await findOwnedTemplate(id);
  const updated = await businessTemplateRepository.setStatus(id, 'active');
  await logAction(admin.id, 'template.activate', `Activated template "${template.name}"`, ipAddress);
  return updated;
}

export async function deactivateTemplate(id, admin, ipAddress) {
  const template = await findOwnedTemplate(id);
  const updated = await businessTemplateRepository.setStatus(id, 'inactive');
  await logAction(admin.id, 'template.deactivate', `Deactivated template "${template.name}" — existing tenants keep working, hidden from new assignment`, ipAddress);
  return updated;
}

export async function archiveTemplate(id, admin, ipAddress) {
  const template = await findOwnedTemplate(id);
  const updated = await businessTemplateRepository.setStatus(id, 'archived');
  await logAction(admin.id, 'template.archive', `Archived template "${template.name}"`, ipAddress);
  return updated;
}

// Bulk enable/disable — invalidates every tenant's resolved-module cache
// (not just one tenant's) since any number of tenants may be on this
// template.
export async function setModules(templateId, moduleSettings, admin, ipAddress) {
  const template = await findOwnedTemplate(templateId);
  const updated = await templateModuleRepository.bulkSetEnabled(templateId, moduleSettings);
  invalidateModuleRegistryCache();
  await logAction(admin.id, 'template.set_modules', `Updated module map for template "${template.name}"`, ipAddress);
  return updated;
}

export async function setDefaultSetting(templateId, key, value, dataType, admin, ipAddress) {
  const template = await findOwnedTemplate(templateId);
  const settings = await templateSettingsRepository.upsert(templateId, key, value, dataType);
  await logAction(admin.id, 'template.set_default_setting', `Set default setting "${key}" for template "${template.name}"`, ipAddress);
  return settings;
}
