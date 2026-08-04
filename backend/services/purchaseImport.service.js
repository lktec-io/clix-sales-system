import ExcelJS from 'exceljs';
import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as categoryRepository from '../repositories/category.repository.js';
import * as supplierRepository from '../repositories/supplier.repository.js';
import * as productRepository from '../repositories/product.repository.js';
import * as purchaseRepository from '../repositories/purchase.repository.js';
import * as inventoryRepository from '../repositories/inventory.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const TEMPLATE_COLUMNS = [
  { header: 'Product Name', key: 'productName', width: 28 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Supplier', key: 'supplier', width: 24 },
  { header: 'Buying Price', key: 'buyingPrice', width: 14 },
  { header: 'Selling Price', key: 'sellingPrice', width: 14 },
  { header: 'Quantity', key: 'quantity', width: 12 },
  { header: 'Minimum Stock', key: 'minStock', width: 14 },
  { header: 'Barcode', key: 'barcode', width: 16 },
  { header: 'SKU', key: 'sku', width: 16 },
  { header: 'Description', key: 'description', width: 32 },
];

const HEADER_KEY_ALIASES = {
  'product name': 'productName',
  category: 'category',
  supplier: 'supplier',
  'buying price': 'buyingPrice',
  'selling price': 'sellingPrice',
  quantity: 'quantity',
  'minimum stock': 'minStock',
  'min stock': 'minStock',
  barcode: 'barcode',
  sku: 'sku',
  description: 'description',
};

export async function buildImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Clix Sales System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Purchases Import');
  sheet.columns = TEMPLATE_COLUMNS;

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  });

  sheet.addRow({
    productName: 'Example Ceiling Fan',
    category: 'Electronics',
    supplier: 'Acme Suppliers Ltd',
    buyingPrice: 15000,
    sellingPrice: 22000,
    quantity: 20,
    minStock: 5,
    barcode: '',
    sku: '',
    description: 'Example row — delete before importing',
  });

  return workbook;
}

// Reads the uploaded workbook's first sheet into plain row objects, matched
// against the template's headers by name (not fixed column position) so a
// user who reorders columns in Excel still imports correctly. Fully blank
// rows (e.g. leftover template rows below the data) are silently skipped —
// only a row with at least one populated cell is reported as data needing
// validation.
export async function parseImportFile(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, 'The uploaded file has no worksheet');

  const columnForKey = {};
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const normalized = String(cell.value || '').trim().toLowerCase();
    const key = HEADER_KEY_ALIASES[normalized];
    if (key) columnForKey[key] = colNumber;
  });

  const readCell = (row, key) => {
    const col = columnForKey[key];
    if (!col) return null;
    const value = row.getCell(col).value;
    if (value === null || value === undefined || value === '') return null;
    return typeof value === 'object' && value.text ? value.text : value;
  };

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const productName = readCell(row, 'productName');
    const category = readCell(row, 'category');
    const supplier = readCell(row, 'supplier');
    const buyingPrice = readCell(row, 'buyingPrice');
    const sellingPrice = readCell(row, 'sellingPrice');
    const quantity = readCell(row, 'quantity');
    const hasAnyValue = [productName, category, supplier, buyingPrice, sellingPrice, quantity].some((v) => v !== null);
    if (!hasAnyValue) return;

    rows.push({
      rowNumber,
      productName: productName != null ? String(productName).trim() : '',
      category: category != null ? String(category).trim() : '',
      supplier: supplier != null ? String(supplier).trim() : '',
      buyingPrice,
      sellingPrice,
      quantity,
      minStock: readCell(row, 'minStock'),
      barcode: (readCell(row, 'barcode') ?? '').toString().trim() || null,
      sku: (readCell(row, 'sku') ?? '').toString().trim() || null,
      description: (readCell(row, 'description') ?? '').toString().trim() || null,
    });
  });

  return rows;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// Validates every parsed row and resolves it against the DB (supplier must
// already exist; category is reused if found, else flagged to be
// auto-created on commit; an existing product is matched by SKU/Barcode ==
// products.code, the same field the app already treats as the de-facto
// barcode). Runs identically at preview time and again at commit time —
// commit never trusts the client-echoed preview rows as still accurate,
// since a supplier/product could change between the two calls.
export async function validateRows(rawRows, tenantId) {
  const seen = new Map();
  const results = [];

  for (const raw of rawRows) {
    const errors = [];
    const warnings = [];

    if (!raw.productName) errors.push('Product Name is required');
    if (!raw.category) errors.push('Category is required');
    if (!raw.supplier) errors.push('Supplier is required');

    const buyingPrice = toNumber(raw.buyingPrice);
    if (raw.buyingPrice === null || raw.buyingPrice === undefined || raw.buyingPrice === '') {
      errors.push('Buying Price is required');
    } else if (buyingPrice === null || buyingPrice < 0) {
      errors.push('Buying Price must be a positive number');
    }

    const sellingPrice = toNumber(raw.sellingPrice);
    if (raw.sellingPrice === null || raw.sellingPrice === undefined || raw.sellingPrice === '') {
      errors.push('Selling Price is required');
    } else if (sellingPrice === null || sellingPrice < 0) {
      errors.push('Selling Price must be a positive number');
    }

    const quantity = toNumber(raw.quantity);
    if (raw.quantity === null || raw.quantity === undefined || raw.quantity === '') {
      errors.push('Quantity is required');
    } else if (quantity === null || !Number.isInteger(quantity) || quantity <= 0) {
      errors.push('Quantity must be a positive whole number');
    }

    let minStock = 0;
    if (raw.minStock !== null && raw.minStock !== undefined && raw.minStock !== '') {
      const parsedMinStock = toNumber(raw.minStock);
      if (parsedMinStock === null || parsedMinStock < 0) {
        errors.push('Minimum Stock cannot be negative');
      } else {
        minStock = parsedMinStock;
      }
    }

    let supplierRecord = null;
    if (raw.supplier) {
      supplierRecord = await supplierRepository.findByName(raw.supplier, tenantId);
      if (!supplierRecord) errors.push(`Unknown supplier "${raw.supplier}"`);
    }

    let categoryRecord = null;
    if (raw.category) {
      categoryRecord = await categoryRepository.findByNameCaseInsensitive(raw.category, tenantId);
      if (!categoryRecord) warnings.push(`Category "${raw.category}" will be created`);
    }

    const explicitCode = raw.sku || raw.barcode || null;
    const matchedProduct = explicitCode ? await productRepository.findByCode(explicitCode, tenantId) : null;

    // Flags accidental double-entry within the same file — still imported
    // (a second, genuinely separate purchase line for the same product in
    // one file is legitimate), just surfaced so the importer can catch a
    // copy-paste mistake before confirming.
    const dedupeKey = explicitCode
      ? `code:${explicitCode.toLowerCase()}`
      : `name:${raw.productName.toLowerCase()}|${raw.category.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      warnings.push(`Duplicate of row ${seen.get(dedupeKey)} in this file`);
    } else {
      seen.set(dedupeKey, raw.rowNumber);
    }

    results.push({
      rowNumber: raw.rowNumber,
      productName: raw.productName,
      category: raw.category,
      supplier: raw.supplier,
      buyingPrice,
      sellingPrice,
      quantity,
      minStock,
      barcode: raw.barcode,
      sku: raw.sku,
      description: raw.description,
      action: matchedProduct ? 'update' : 'create',
      productId: matchedProduct?.id || null,
      supplierId: supplierRecord?.id || null,
      categoryId: categoryRecord?.id || null,
      categoryCode: categoryRecord?.code || null,
      status: errors.length > 0 ? 'invalid' : 'valid',
      errors,
      warnings,
    });
  }

  const summary = {
    totalRows: results.length,
    validRows: results.filter((r) => r.status === 'valid').length,
    invalidRows: results.filter((r) => r.status === 'invalid').length,
    duplicateRows: results.filter((r) => r.warnings.some((w) => w.startsWith('Duplicate'))).length,
    rowsToCreate: results.filter((r) => r.status === 'valid' && r.action === 'create').length,
    rowsToUpdate: results.filter((r) => r.status === 'valid' && r.action === 'update').length,
  };

  return { rows: results, summary };
}

async function generateUniqueCategoryCode(name, tenantId) {
  const base = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'CAT';
  let code = base;
  let suffix = 1;
  // Sequential, not concurrent — safe against races because the whole
  // import runs one supplier group at a time, one row at a time.
  while (await categoryRepository.findByCode(code, tenantId)) {
    suffix += 1;
    code = `${base}${suffix}`;
  }
  return code;
}

// categoryCache is shared across every row this commitImport() call
// processes (all supplier groups, not just one) and keyed by lowercased
// name. Without it, two rows naming the same brand-new category would each
// run findByNameCaseInsensitive() on a plain pool connection that can't see
// the other row's still-uncommitted INSERT (it's inside this transaction,
// on this transaction's own connection) — both would try to create it,
// colliding on the UNIQUE name/code constraint. Rows are processed strictly
// sequentially (no concurrency within one import), so this in-memory cache
// is authoritative and never goes stale mid-run.
async function ensureCategory(name, actorId, tenantId, connection, categoryCache) {
  const key = name.toLowerCase();
  if (categoryCache.has(key)) return categoryCache.get(key);

  const existing = await categoryRepository.findByNameCaseInsensitive(name, tenantId);
  if (existing) {
    categoryCache.set(key, existing);
    return existing;
  }

  const code = await generateUniqueCategoryCode(name, tenantId);
  const [result] = await connection.query(
    "INSERT INTO categories (tenant_id, name, code, status, created_by, updated_by) VALUES (?, ?, ?, 'active', ?, ?)",
    [tenantId, name, code, actorId, actorId],
  );
  const created = { id: result.insertId, name, code };
  categoryCache.set(key, created);
  return created;
}

// One purchase order per supplier represented in the file (the template has
// no per-row branch column, so branchId is chosen once for the whole
// import, but different rows can and do name different suppliers, and
// purchase_orders is one-supplier-per-order). Each supplier group is its
// own transaction; within it, each row runs inside its own SAVEPOINT so a
// single bad row (an unexpected DB error slipping past pre-validation)
// rolls back only that row's writes and is recorded as skipped — the rest
// of the group's rows, and every other supplier's group, still commit.
export async function commitImport(rawRows, { branchId }, actorId, tenantId) {
  const branch = await branchRepository.findById(branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  if (!rawRows?.length) throw new ApiError(400, 'No rows to import');

  const { rows: revalidated } = await validateRows(rawRows, tenantId);

  const errors = [];
  const warnings = [];
  let rowsImported = 0;
  let productsCreated = 0;
  let productsUpdated = 0;
  let rowsSkipped = 0;
  let purchaseOrdersCreated = 0;

  revalidated.forEach((row) => {
    row.warnings.forEach((message) => warnings.push({ row: row.rowNumber, message }));
    if (row.status === 'invalid') {
      errors.push({ row: row.rowNumber, message: row.errors.join('; ') });
      rowsSkipped += 1;
    }
  });

  const categoryCache = new Map();
  const validRows = revalidated.filter((row) => row.status === 'valid');
  const bySupplier = new Map();
  validRows.forEach((row) => {
    if (!bySupplier.has(row.supplierId)) bySupplier.set(row.supplierId, []);
    bySupplier.get(row.supplierId).push(row);
  });

  for (const [supplierId, supplierRows] of bySupplier) {
    const supplier = await supplierRepository.findById(supplierId, tenantId);
    if (!supplier) {
      supplierRows.forEach((row) => {
        errors.push({ row: row.rowNumber, message: 'Supplier no longer exists' });
        rowsSkipped += 1;
      });
      continue;
    }

    const connection = await pool.getConnection();
    const succeededItems = [];
    let groupCreated = 0;
    let groupUpdated = 0;

    try {
      await connection.beginTransaction();

      for (const row of supplierRows) {
        await connection.query('SAVEPOINT sp_row');
        try {
          let categoryId = row.categoryId;
          let categoryCode = row.categoryCode;
          if (!categoryId) {
            const category = await ensureCategory(row.category, actorId, tenantId, connection, categoryCache);
            categoryId = category.id;
            categoryCode = category.code;
          }

          let productId = row.productId;
          if (productId) {
            await connection.query(
              'UPDATE products SET buying_price = ?, selling_price = ?, min_stock = ?, updated_by = ? WHERE id = ? AND tenant_id = ?',
              [row.buyingPrice, row.sellingPrice, row.minStock, actorId, productId, tenantId],
            );
            groupUpdated += 1;
          } else {
            const code = row.sku || row.barcode || await generateCode(`PRODUCT_${categoryCode}`, categoryCode, { tenantId });
            const [result] = await connection.query(
              `INSERT INTO products (tenant_id, name, code, category_id, brand_id, description, buying_price, selling_price, min_stock, status, created_by, updated_by)
               VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 'active', ?, ?)`,
              [tenantId, row.productName, code, categoryId, row.description, row.buyingPrice, row.sellingPrice, row.minStock, actorId, actorId],
            );
            productId = result.insertId;
            groupCreated += 1;
          }

          succeededItems.push({ productId, quantity: row.quantity, buyingPrice: row.buyingPrice });
          await connection.query('RELEASE SAVEPOINT sp_row');
        } catch (rowErr) {
          await connection.query('ROLLBACK TO SAVEPOINT sp_row');
          errors.push({ row: row.rowNumber, message: rowErr.message });
          rowsSkipped += 1;
        }
      }

      if (succeededItems.length === 0) {
        await connection.rollback();
        continue;
      }

      const purchaseNumber = await generateCode('PURCHASE', 'PUR', { tenantId, padLength: 6 });
      const totalAmount = succeededItems.reduce((sum, item) => sum + item.quantity * item.buyingPrice, 0);
      const orderId = await purchaseRepository.createOrder(
        { tenantId, purchaseNumber, supplierId, branchId, totalAmount, userId: actorId },
        connection,
      );

      for (const item of succeededItems) {
        const lineTotal = item.quantity * item.buyingPrice;
        await purchaseRepository.createItem(
          { purchaseOrderId: orderId, productId: item.productId, quantity: item.quantity, buyingPrice: item.buyingPrice, lineTotal },
          connection,
        );
        await inventoryRepository.recordMovement(
          {
            tenantId,
            productId: item.productId,
            branchId,
            movementType: 'purchase',
            quantityChange: item.quantity,
            referenceType: 'purchase_order',
            referenceId: orderId,
            userId: actorId,
          },
          connection,
        );
      }

      await connection.commit();

      rowsImported += succeededItems.length;
      productsCreated += groupCreated;
      productsUpdated += groupUpdated;
      purchaseOrdersCreated += 1;

      await activityLogRepository.create({
        tenantId,
        userId: actorId,
        branchId,
        description: `Purchase "${purchaseNumber}" imported from Excel (${succeededItems.length} item${succeededItems.length === 1 ? '' : 's'}) from "${supplier.name}"`,
        referenceType: 'purchase_order',
        referenceId: orderId,
      });

      await notificationRepository.notifyBranchManagement(tenantId, branchId, {
        type: 'success',
        category: 'purchase_completed',
        title: 'Purchase imported',
        message: `Purchase "${purchaseNumber}" (${formatCurrency(totalAmount)}) imported from Excel for "${supplier.name}" at "${branch.name}"`,
        referenceType: 'purchase_order',
        referenceId: orderId,
      });
    } catch (err) {
      await connection.rollback();
      supplierRows.forEach((row) => {
        errors.push({ row: row.rowNumber, message: err.message });
        rowsSkipped += 1;
      });
    } finally {
      connection.release();
    }
  }

  return { rowsImported, productsCreated, productsUpdated, rowsSkipped, purchaseOrdersCreated, errors, warnings };
}
