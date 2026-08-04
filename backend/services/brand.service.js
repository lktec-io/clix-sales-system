import { ApiError } from '../utils/apiError.js';
import * as brandRepository from '../repositories/brand.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listBrands(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await brandRepository.findAll({
    tenantId,
    page,
    limit,
    search: query.search,
    status: query.status,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function assertUnique({ name, code }, tenantId, excludeId = null) {
  const nameConflict = await brandRepository.findByName(name, tenantId);
  if (nameConflict && nameConflict.id !== excludeId) {
    throw new ApiError(409, 'A brand with this name already exists');
  }
  const codeConflict = await brandRepository.findByCode(code, tenantId);
  if (codeConflict && codeConflict.id !== excludeId) {
    throw new ApiError(409, 'A brand with this code already exists');
  }
}

export async function createBrand(data, actorId, tenantId) {
  await assertUnique(data, tenantId);
  const brand = await brandRepository.create({ ...data, userId: actorId, tenantId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Brand "${brand.name}" created`,
    referenceType: 'brand',
    referenceId: brand.id,
  });
  return brand;
}

export async function updateBrand(id, data, actorId, tenantId) {
  const existing = await brandRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Brand not found');

  await assertUnique(data, tenantId, id);
  const brand = await brandRepository.update(id, tenantId, { ...data, userId: actorId });
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Brand "${brand.name}" updated`,
    referenceType: 'brand',
    referenceId: id,
  });
  return brand;
}

export async function deleteBrand(id, actorId, tenantId) {
  const existing = await brandRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Brand not found');

  const productCount = await brandRepository.countProducts(id, tenantId);
  if (productCount > 0) {
    throw new ApiError(409, `Cannot delete this brand — ${productCount} product(s) still reference it`);
  }

  await brandRepository.softDelete(id, tenantId, actorId);
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Brand "${existing.name}" deleted`,
    referenceType: 'brand',
    referenceId: id,
  });
}
