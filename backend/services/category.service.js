import { ApiError } from '../utils/apiError.js';
import * as categoryRepository from '../repositories/category.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listCategories(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await categoryRepository.findAll({
    tenantId,
    page,
    limit,
    search: query.search,
    status: query.status,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function assertUnique({ name, code }, tenantId, excludeId = null) {
  const nameConflict = await categoryRepository.findByName(name, tenantId);
  if (nameConflict && nameConflict.id !== excludeId) {
    throw new ApiError(409, 'A category with this name already exists');
  }
  const codeConflict = await categoryRepository.findByCode(code, tenantId);
  if (codeConflict && codeConflict.id !== excludeId) {
    throw new ApiError(409, 'A category with this code already exists');
  }
}

export async function createCategory(data, actorId, tenantId) {
  await assertUnique(data, tenantId);
  const category = await categoryRepository.create({ ...data, userId: actorId, tenantId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Category "${category.name}" created`,
    referenceType: 'category',
    referenceId: category.id,
  });
  return category;
}

export async function updateCategory(id, data, actorId, tenantId) {
  const existing = await categoryRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Category not found');

  await assertUnique(data, tenantId, id);
  const category = await categoryRepository.update(id, tenantId, { ...data, userId: actorId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Category "${category.name}" updated`,
    referenceType: 'category',
    referenceId: id,
  });
  return category;
}

export async function deleteCategory(id, actorId, tenantId) {
  const existing = await categoryRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Category not found');

  const usageCount = await categoryRepository.countUsage(id, tenantId);
  if (usageCount > 0) {
    throw new ApiError(409, `Category cannot be deleted because it is currently being used by ${usageCount} item(s).`);
  }

  await categoryRepository.hardDelete(id, tenantId);
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Category "${existing.name}" permanently deleted`,
    referenceType: 'category',
    referenceId: id,
  });
}
