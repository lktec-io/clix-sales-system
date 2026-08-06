import { ApiError } from '../utils/apiError.js';
import * as moduleRepository from '../repositories/module.repository.js';
import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';
import { invalidateModuleRegistryCache } from './moduleResolution.service.js';

async function findOwnedModule(id) {
  const module = await moduleRepository.findById(id);
  if (!module) throw new ApiError(404, 'Module not found');
  return module;
}

async function logAction(platformAdminId, action, description, ipAddress) {
  await platformAuditLogRepository.create({ platformAdminId, action, description, tenantId: null, ipAddress });
}

export async function listForAdmin() {
  return moduleRepository.findAllForAdmin();
}

export async function getById(id) {
  return findOwnedModule(id);
}

export async function createModule(data, admin, ipAddress) {
  const existing = await moduleRepository.findByKey(data.key);
  if (existing) throw new ApiError(409, 'A module with this key already exists');

  const module = await moduleRepository.create(data);
  invalidateModuleRegistryCache();
  await logAction(admin.id, 'module.create', `Created module "${module.name}" (${module.key})`, ipAddress);
  return module;
}

export async function updateModule(id, data, admin, ipAddress) {
  await findOwnedModule(id);
  const module = await moduleRepository.update(id, data);
  invalidateModuleRegistryCache();
  await logAction(admin.id, 'module.update', `Updated module "${module.name}"`, ipAddress);
  return module;
}

export async function activateModule(id, admin, ipAddress) {
  const module = await findOwnedModule(id);
  const updated = await moduleRepository.setActive(id, true);
  invalidateModuleRegistryCache();
  await logAction(admin.id, 'module.activate', `Activated module "${module.name}"`, ipAddress);
  return updated;
}

export async function deactivateModule(id, admin, ipAddress) {
  const module = await findOwnedModule(id);
  if (module.is_core) throw new ApiError(400, 'Core modules cannot be deactivated');
  const updated = await moduleRepository.setActive(id, false);
  invalidateModuleRegistryCache();
  await logAction(admin.id, 'module.deactivate', `Deactivated module "${module.name}"`, ipAddress);
  return updated;
}
