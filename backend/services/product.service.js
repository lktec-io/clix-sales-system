import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import * as productRepository from '../repositories/product.repository.js';
import * as categoryRepository from '../repositories/category.repository.js';
import * as brandRepository from '../repositories/brand.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { generateCode } from '../repositories/sequence.repository.js';
import { resolveUploadedFileUrl, deleteUploadedFile } from '../middlewares/upload.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

export async function listProducts(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await productRepository.findAll({
    tenantId,
    page,
    limit,
    search: query.search,
    categoryId: query.categoryId ? Number(query.categoryId) : undefined,
    brandId: query.brandId ? Number(query.brandId) : undefined,
    status: query.status,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getProduct(id, tenantId) {
  const product = await productRepository.findById(id, tenantId);
  if (!product) throw new ApiError(404, 'Product not found');
  return product;
}

// Backs the POS product grid — active products with their live stock at one
// branch. Branch-scoped the same way every other branch-owned read is.
export async function getSellableProducts(query, user) {
  if (!query.branchId) throw new ApiError(400, 'Branch is required');
  const branchId = Number(query.branchId);

  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }

  return productRepository.findSellable({
    tenantId: user.tenantId,
    branchId,
    search: query.search,
    categoryId: query.categoryId ? Number(query.categoryId) : undefined,
    limit: Math.min(Number(query.limit) || 60, 200),
  });
}

// The barcode scanner's only lookup — exact match, not the fuzzy `search`
// findSellable() does for the product grid. Returns null (not a 404) on no
// match: "barcode doesn't resolve to a product" is an ordinary, expected
// outcome of scanning, not an error condition.
export async function getSellableProductByCode(query, user) {
  if (!query.branchId) throw new ApiError(400, 'Branch is required');
  if (!query.code) throw new ApiError(400, 'Code is required');
  const branchId = Number(query.branchId);

  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }

  return productRepository.findSellableByCode({ tenantId: user.tenantId, code: query.code.trim(), branchId });
}

function assertPriceSanity(data) {
  if (Number(data.buyingPrice) > Number(data.sellingPrice) && !data.confirmPriceOverride) {
    throw new ApiError(
      422,
      'Buying price is higher than selling price. Confirm this is intentional to proceed.',
      [{ field: 'sellingPrice', message: 'PRICE_OVERRIDE_REQUIRED' }],
    );
  }
}

export async function createProduct(data, actorId, tenantId) {
  const category = await categoryRepository.findById(data.categoryId, tenantId);
  if (!category) throw new ApiError(400, 'Selected category does not exist');

  // Brand is optional — only validated (must reference a real row) when
  // the caller actually sent one, not required to be present at all.
  if (data.brandId) {
    const brand = await brandRepository.findById(data.brandId, tenantId);
    if (!brand) throw new ApiError(400, 'Selected brand does not exist');
  }

  assertPriceSanity(data);

  const code = await generateCode(`PRODUCT_${category.code}`, category.code, { tenantId });

  const product = await productRepository.create({ ...data, code, userId: actorId, tenantId });
  await activityLogRepository.create({
    userId: actorId,
    branchId: null,
    description: `Product "${product.name}" (${product.code}) created`,
    referenceType: 'product',
    referenceId: product.id,
  });
  return product;
}

export async function updateProduct(id, data, actorId, tenantId) {
  const existing = await productRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Product not found');

  const category = await categoryRepository.findById(data.categoryId, tenantId);
  if (!category) throw new ApiError(400, 'Selected category does not exist');

  if (data.brandId) {
    const brand = await brandRepository.findById(data.brandId, tenantId);
    if (!brand) throw new ApiError(400, 'Selected brand does not exist');
  }

  assertPriceSanity(data);

  const product = await productRepository.update(id, tenantId, { ...data, userId: actorId });
  await activityLogRepository.create({
    userId: actorId,
    branchId: null,
    description: `Product "${product.name}" (${product.code}) updated`,
    referenceType: 'product',
    referenceId: id,
  });
  return product;
}

export async function bulkUpdateStatus(ids, status, actorId, tenantId) {
  if (!ids?.length) throw new ApiError(400, 'No products selected');
  await productRepository.bulkUpdateStatus(ids, tenantId, status, actorId);
}

// Best-effort cleanup of a product's uploaded image files before the row
// (and its product_images rows, via ON DELETE CASCADE) is actually
// removed — otherwise a hard delete leaves orphaned files on disk/Cloudinary
// with nothing left in the DB to ever clean them up later. Mirrors
// removeImage()'s per-file cleanup below; never throws, since a failed file
// cleanup shouldn't block the delete itself.
async function cleanupProductImageFiles(images) {
  await Promise.all((images || []).map(async (image) => {
    try {
      if (image.image_path.startsWith('/uploads/')) {
        await fs.unlink(path.join(UPLOADS_ROOT, image.image_path.replace('/uploads/', '')));
      } else {
        await deleteUploadedFile(image.image_path);
      }
    } catch {
      // Already gone, inaccessible, or a Cloudinary failure already logged
      // inside deleteUploadedFile — not fatal to the product delete itself.
    }
  }));
}

// Real permanent deletion, always — no archive fallback, no dependency on
// a separate migration having been run first. ensureProductDeletionSchema()
// inspects this database's actual schema and brings it into a compatible
// shape itself (adding the snapshot columns / relaxing the FK if they
// aren't already there) before anything else runs, so there is no case
// left where deleting a product needs to be refused. That step is DDL and
// runs standalone, before the transaction opens — DDL causes an implicit
// commit in MySQL, so it can't safely run inside the same transaction as
// the delete itself (see its comment). Once the schema is confirmed
// compatible, the actual delete is one all-or-nothing transaction — if any
// step fails, nothing about the product or its related rows changes.
export async function deleteProduct(id, actorId, tenantId) {
  const existing = await productRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Product not found');

  const hadHistory = await productRepository.hasTransactionHistory(id);
  await productRepository.ensureProductDeletionSchema();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await productRepository.purgeProduct({ id, name: existing.name, code: existing.code, buyingPrice: existing.buying_price }, connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    // purgeProduct() already self-heals the one FK shape it knows how to
    // fix (sale_items/purchase_items). Reaching this with a row-referenced
    // error means some other, unanticipated table/constraint is blocking
    // it — surface MySQL's own message (it already names the exact table,
    // column, and constraint) instead of a guess.
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      throw new ApiError(409, `Cannot delete "${existing.name}" — blocked by a database relationship: ${err.sqlMessage || err.message}`);
    }
    throw err;
  } finally {
    connection.release();
  }

  await cleanupProductImageFiles(existing.images);
  await activityLogRepository.create({
    userId: actorId,
    branchId: null,
    description: hadHistory
      ? `Product "${existing.name}" (${existing.code}) permanently deleted — sales/purchase records preserved with a name snapshot`
      : `Product "${existing.name}" (${existing.code}) permanently deleted`,
    referenceType: 'product',
    referenceId: id,
  });
  return { archived: false };
}

export async function listArchivedProducts(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await productRepository.findAllArchived({ tenantId, page, limit, search: query.search });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function restoreProduct(id, actorId, tenantId) {
  const existing = await productRepository.findArchivedById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Archived product not found');

  const restored = await productRepository.restore(id, tenantId, actorId);
  await activityLogRepository.create({
    userId: actorId,
    branchId: null,
    description: `Product "${existing.name}" (${existing.code}) restored from archive`,
    referenceType: 'product',
    referenceId: id,
  });
  return restored;
}

// Handles any product archived before this hotfix shipped (deleteProduct()
// no longer creates new archives — see its comment) — same safe purge as
// the main delete flow, just reading from the archived-only lookup so it
// only ever acts on a product that's already soft-deleted.
export async function permanentlyDeleteProduct(id, actorId, tenantId) {
  const existing = await productRepository.findArchivedById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Archived product not found');

  await productRepository.ensureProductDeletionSchema();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await productRepository.purgeProduct({ id, name: existing.name, code: existing.code, buyingPrice: existing.buying_price }, connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      throw new ApiError(409, `Cannot delete "${existing.name}" — blocked by a database relationship: ${err.sqlMessage || err.message}`);
    }
    throw err;
  } finally {
    connection.release();
  }

  await cleanupProductImageFiles(existing.images);
  await activityLogRepository.create({
    userId: actorId,
    branchId: null,
    description: `Product "${existing.name}" (${existing.code}) permanently deleted from archive`,
    referenceType: 'product',
    referenceId: id,
  });
}

export async function addImage(productId, file, isPrimary, tenantId) {
  const product = await productRepository.findById(productId, tenantId);
  if (!product) throw new ApiError(404, 'Product not found');

  const imagePath = resolveUploadedFileUrl(file, 'products');
  const shouldBePrimary = isPrimary || product.images.length === 0;
  await productRepository.addImage(productId, imagePath, shouldBePrimary);
  return productRepository.findById(productId, tenantId);
}

export async function removeImage(productId, imageId, tenantId) {
  const product = await productRepository.findById(productId, tenantId);
  if (!product) throw new ApiError(404, 'Product not found');

  const image = await productRepository.findImageById(imageId);
  if (!image || image.product_id !== productId) {
    throw new ApiError(404, 'Image not found');
  }

  await productRepository.removeImage(imageId, productId);

  if (image.image_path.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_ROOT, image.image_path.replace('/uploads/', ''));
    fs.unlink(filePath).catch(() => {
      // File already gone or inaccessible — not fatal.
    });
  } else {
    deleteUploadedFile(image.image_path).catch(() => {
      // Cloudinary cleanup failures are already logged inside deleteUploadedFile — not fatal.
    });
  }

  return productRepository.findById(productId, tenantId);
}
