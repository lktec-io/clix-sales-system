import ExcelJS from 'exceljs';
import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import * as categoryRepository from '../repositories/category.repository.js';
import * as supplierRepository from '../repositories/supplier.repository.js';
import * as medicineBatchRepository from '../repositories/medicineBatch.repository.js';
import * as pharmacyStockMovementRepository from '../repositories/pharmacyStockMovement.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

// Pharmacy's own "Import Medicines" flow — a distinctly-branded sibling to
// purchaseImport.service.js (the retail Products import), not a shared
// generic import. It writes against the schema exactly as it exists today
// (medicines has no generic_name/brand column — see 031_create_pharmacy_
// tables.sql) so those columns are deliberately absent from the template.
const TEMPLATE_COLUMNS = [
  { header: 'Medicine Name', key: 'medicineName', width: 28 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Unit', key: 'unit', width: 12 },
  { header: 'Purchase Price', key: 'purchasePrice', width: 14 },
  { header: 'Selling Price', key: 'sellingPrice', width: 14 },
  { header: 'Opening Stock', key: 'openingStock', width: 14 },
  { header: 'Minimum Stock', key: 'minimumStock', width: 14 },
  { header: 'Batch Number', key: 'batchNumber', width: 16 },
  { header: 'Expiry Date', key: 'expiryDate', width: 14 },
  { header: 'Supplier', key: 'supplier', width: 24 },
];

const HEADER_KEY_ALIASES = {
  'medicine name': 'medicineName',
  category: 'category',
  unit: 'unit',
  'purchase price': 'purchasePrice',
  'buying price': 'purchasePrice',
  'selling price': 'sellingPrice',
  'opening stock': 'openingStock',
  'minimum stock': 'minimumStock',
  'min stock': 'minimumStock',
  'reorder level': 'minimumStock',
  'batch number': 'batchNumber',
  'batch #': 'batchNumber',
  'expiry date': 'expiryDate',
  supplier: 'supplier',
};

export async function buildImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Clix Sales System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Medicines Import');
  sheet.columns = TEMPLATE_COLUMNS;

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  });

  const exampleExpiry = new Date();
  exampleExpiry.setFullYear(exampleExpiry.getFullYear() + 1);

  sheet.addRow({
    medicineName: 'Example Paracetamol 500mg',
    category: 'Pain Relief',
    unit: 'tablet',
    purchasePrice: 50,
    sellingPrice: 100,
    openingStock: 200,
    minimumStock: 20,
    batchNumber: 'BATCH-0001',
    expiryDate: exampleExpiry.toISOString().slice(0, 10),
    supplier: 'Example Pharma Distributors',
  }).getCell('expiryDate').numFmt = 'yyyy-mm-dd';

  return workbook;
}

// Reads the uploaded workbook's first sheet into plain row objects, matched
// against the template's headers by name (not fixed column position), the
// same approach purchaseImport.service.js uses so a reordered column still
// imports correctly. Fully blank rows are silently skipped.
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

    const medicineName = readCell(row, 'medicineName');
    const category = readCell(row, 'category');
    const sellingPrice = readCell(row, 'sellingPrice');
    const openingStock = readCell(row, 'openingStock');
    const batchNumber = readCell(row, 'batchNumber');
    const hasAnyValue = [medicineName, category, sellingPrice, openingStock, batchNumber].some((v) => v !== null);
    if (!hasAnyValue) return;

    rows.push({
      rowNumber,
      medicineName: medicineName != null ? String(medicineName).trim() : '',
      category: category != null ? String(category).trim() : '',
      unit: (readCell(row, 'unit') ?? '').toString().trim() || null,
      purchasePrice: readCell(row, 'purchasePrice'),
      sellingPrice,
      openingStock: readCell(row, 'openingStock'),
      minimumStock: readCell(row, 'minimumStock'),
      batchNumber: batchNumber != null ? String(batchNumber).trim() : '',
      expiryDate: readCell(row, 'expiryDate'),
      supplier: (readCell(row, 'supplier') ?? '').toString().trim() || null,
    });
  });

  return rows;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// Excel date-formatted cells load as JS Date objects; a typed-in string
// (e.g. "2027-12-31") loads as plain text. Both are accepted; anything that
// doesn't resolve to a real calendar date is rejected.
function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function err(row, field, problem, expected) {
  return { row, field, problem, expected };
}

// Validates and resolves every parsed row against the DB (category is
// reused if found, else flagged to be auto-created on commit, same as
// purchaseImport.service.js; supplier is only resolved if it already
// exists — never auto-created, matching supplier.repository.js#findByName's
// own documented convention). Runs identically at preview time and again
// at commit time, so commit never trusts client-echoed preview rows as
// still accurate.
export async function validateRows(rawRows, tenantId) {
  const seenNames = new Map();
  const validRows = [];
  const errors = [];

  for (const raw of rawRows) {
    const rowErrors = [];

    if (!raw.medicineName) {
      rowErrors.push(err(raw.rowNumber, 'Medicine Name', 'Medicine Name is required', 'A non-empty medicine name, e.g. "Paracetamol 500mg"'));
    } else if (raw.medicineName.length > 150) {
      rowErrors.push(err(raw.rowNumber, 'Medicine Name', 'Medicine Name is too long', 'At most 150 characters'));
    }

    if (raw.unit && raw.unit.length > 30) {
      rowErrors.push(err(raw.rowNumber, 'Unit', 'Unit is too long', 'At most 30 characters, e.g. "tablet", "bottle", "box"'));
    }

    let sellingPrice = null;
    if (raw.sellingPrice === null || raw.sellingPrice === undefined || raw.sellingPrice === '') {
      rowErrors.push(err(raw.rowNumber, 'Selling Price', 'Selling Price is required', 'A number greater than zero, e.g. 100'));
    } else {
      sellingPrice = toNumber(raw.sellingPrice);
      if (sellingPrice === null || sellingPrice <= 0) {
        rowErrors.push(err(raw.rowNumber, 'Selling Price', 'Selling Price must be a number greater than zero', 'A number greater than zero, e.g. 100'));
      }
    }

    let purchasePrice = null;
    if (raw.purchasePrice !== null && raw.purchasePrice !== undefined && raw.purchasePrice !== '') {
      purchasePrice = toNumber(raw.purchasePrice);
      if (purchasePrice === null || purchasePrice < 0) {
        rowErrors.push(err(raw.rowNumber, 'Purchase Price', 'Purchase Price must be a positive number', 'A number of zero or more, e.g. 50'));
        purchasePrice = null;
      }
    }

    let openingStock = 0;
    if (raw.openingStock !== null && raw.openingStock !== undefined && raw.openingStock !== '') {
      const parsed = toNumber(raw.openingStock);
      if (parsed === null || !Number.isInteger(parsed) || parsed < 0) {
        rowErrors.push(err(raw.rowNumber, 'Opening Stock', 'Opening Stock must be a positive whole number', 'A whole number of zero or more, e.g. 200'));
      } else {
        openingStock = parsed;
      }
    }

    let minimumStock = 0;
    if (raw.minimumStock !== null && raw.minimumStock !== undefined && raw.minimumStock !== '') {
      const parsed = toNumber(raw.minimumStock);
      if (parsed === null || !Number.isInteger(parsed) || parsed < 0) {
        rowErrors.push(err(raw.rowNumber, 'Minimum Stock', 'Minimum Stock must be a positive whole number', 'A whole number of zero or more, e.g. 20'));
      } else {
        minimumStock = parsed;
      }
    }

    // Batch Number and Expiry Date are only required when there is stock to
    // receive — a catalog-only row (Opening Stock blank or 0) needs neither,
    // since no medicine_batches row is created for it.
    let expiryDate = null;
    if (openingStock > 0) {
      if (!raw.batchNumber) {
        rowErrors.push(err(raw.rowNumber, 'Batch Number', 'Batch Number is required when Opening Stock is greater than zero', 'A batch/lot identifier, e.g. "BATCH-0001"'));
      } else if (raw.batchNumber.length > 60) {
        rowErrors.push(err(raw.rowNumber, 'Batch Number', 'Batch Number is too long', 'At most 60 characters'));
      }

      if (purchasePrice === null && (raw.purchasePrice === null || raw.purchasePrice === undefined || raw.purchasePrice === '')) {
        rowErrors.push(err(raw.rowNumber, 'Purchase Price', 'Purchase Price is required when Opening Stock is greater than zero', 'A number of zero or more, e.g. 50'));
      }

      if (!raw.expiryDate) {
        rowErrors.push(err(raw.rowNumber, 'Expiry Date', 'Expiry Date is required when Opening Stock is greater than zero', 'A valid date, e.g. 2027-12-31'));
      } else {
        const parsedDate = toDate(raw.expiryDate);
        if (!parsedDate) {
          rowErrors.push(err(raw.rowNumber, 'Expiry Date', 'Expiry Date is not a valid date', 'A valid date, e.g. 2027-12-31'));
        } else if (parsedDate < startOfToday()) {
          rowErrors.push(err(raw.rowNumber, 'Expiry Date', 'Expiry Date must be today or a future date', 'A date that is today or later'));
        } else {
          expiryDate = parsedDate;
        }
      }
    }

    let categoryId = null;
    if (raw.category) {
      const categoryRecord = await categoryRepository.findByNameCaseInsensitive(raw.category, tenantId);
      categoryId = categoryRecord?.id || null;
    }

    let supplierId = null;
    if (raw.supplier) {
      const supplierRecord = await supplierRepository.findByName(raw.supplier, tenantId);
      supplierId = supplierRecord?.id || null;
    }

    // A pasted or copy-pasted duplicate name within the same file would
    // otherwise silently create two separate medicines with an identical
    // name (medicines has no unique constraint on name) — flagged as an
    // error here rather than allowed through, since it's almost always a
    // mistake and is cheap to catch before anything is written.
    if (raw.medicineName) {
      const key = raw.medicineName.toLowerCase();
      if (seenNames.has(key)) {
        rowErrors.push(err(
          raw.rowNumber,
          'Medicine Name',
          `Duplicate of row ${seenNames.get(key)} in this file`,
          'A medicine name that appears only once in this file',
        ));
      } else {
        seenNames.set(key, raw.rowNumber);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    validRows.push({
      rowNumber: raw.rowNumber,
      medicineName: raw.medicineName,
      category: raw.category || null,
      categoryId,
      unit: raw.unit || 'unit',
      purchasePrice,
      sellingPrice,
      openingStock,
      minimumStock,
      batchNumber: openingStock > 0 ? raw.batchNumber : null,
      expiryDate: expiryDate ? expiryDate.toISOString().slice(0, 10) : null,
      supplier: raw.supplier || null,
      supplierId,
    });
  }

  return {
    validRows,
    errors,
    totalRows: rawRows.length,
  };
}

// Mirrors sale.service.js/purchase.service.js/pharmacyPurchase.service.js's
// identical helper — each service keeps its own copy rather than sharing
// one, matching this codebase's existing convention.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

// categoryCache is shared across every row this commitImport() call
// processes, keyed by lowercased name — without it, two rows naming the
// same brand-new category could both try to create it. Rows are processed
// strictly sequentially (no concurrency within one import), so this
// in-memory cache is authoritative for the life of the call. Mirrors
// purchaseImport.service.js#ensureCategory's identical reasoning.
async function ensureCategory(name, actorId, tenantId, connection, categoryCache) {
  const key = name.toLowerCase();
  if (categoryCache.has(key)) return categoryCache.get(key);

  const existing = await categoryRepository.findByNameCaseInsensitive(name, tenantId);
  if (existing) {
    categoryCache.set(key, existing.id);
    return existing.id;
  }

  const base = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'CAT';
  let code = base;
  let suffix = 1;
  while (await categoryRepository.findByCode(code, tenantId)) {
    suffix += 1;
    code = `${base}${suffix}`;
  }

  const [result] = await connection.query(
    "INSERT INTO categories (tenant_id, name, code, status, created_by, updated_by) VALUES (?, ?, ?, 'active', ?, ?)",
    [tenantId, name, code, actorId, actorId],
  );
  categoryCache.set(key, result.insertId);
  return result.insertId;
}

// Every valid row is its own independent unit of work — unlike Purchases
// (one purchase_order groups every line by supplier), an imported medicine
// has no shared parent record, so each row gets its own connection and
// transaction rather than SAVEPOINTs inside a shared one. A failure on one
// row rolls back only that row's own INSERTs and is reported, while every
// other row still commits — matching the "skip and report, don't abort the
// whole import" behavior purchaseImport.service.js's SAVEPOINT approach
// gives it, via a simpler mechanism suited to this shape of data.
async function importRow(row, { tenantId, actorId, branchId }, categoryCache) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let categoryId = row.categoryId;
    if (!categoryId && row.category) {
      categoryId = await ensureCategory(row.category, actorId, tenantId, connection, categoryCache);
    }

    const [result] = await connection.query(
      `INSERT INTO medicines (tenant_id, category_id, name, unit, selling_price, reorder_level, description, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'active', ?, ?)`,
      [tenantId, categoryId || null, row.medicineName, row.unit, row.sellingPrice, row.minimumStock, actorId, actorId],
    );
    const medicineId = result.insertId;

    let batchCreated = false;
    if (row.openingStock > 0) {
      // Supplier may have gone missing between preview and commit — that's
      // not fatal, the batch is still received with supplier_id left null,
      // matching how a blank/unknown Supplier column is already treated.
      let supplierId = row.supplierId;
      if (row.supplier && !supplierId) {
        const supplierRecord = await supplierRepository.findByName(row.supplier, tenantId);
        supplierId = supplierRecord?.id || null;
      }

      const batchId = await medicineBatchRepository.create({
        tenantId, medicineId, branchId, supplierId,
        batchNumber: row.batchNumber, buyingPrice: row.purchasePrice || 0, sellingPrice: null,
        quantity: row.openingStock, expiryDate: row.expiryDate, receivedDate: new Date(),
      }, connection);

      await pharmacyStockMovementRepository.record({
        tenantId, medicineId, batchId, branchId,
        movementType: 'purchase', quantityChange: row.openingStock,
        referenceType: 'medicine_import', referenceId: medicineId, userId: actorId,
      }, connection);
      batchCreated = true;
    }

    await connection.commit();
    return { ok: true, medicineId, batchCreated };
  } catch (rowErr) {
    await connection.rollback();
    // Never surface a raw driver/SQL message to the client — map the one
    // constraint collision that can realistically happen here (a repeat
    // batch number for the same medicine+branch, e.g. importing the same
    // file twice) to a friendly explanation, and fall back to a generic
    // one for anything else so no stack trace/SQL text ever leaks out.
    const friendly = rowErr.code === 'ER_DUP_ENTRY'
      ? 'A batch with this Batch Number already exists for this medicine and branch'
      : 'An unexpected error occurred while saving this row';
    return { ok: false, message: friendly };
  } finally {
    connection.release();
  }
}

// Two-phase import: preview (validateRows only, nothing written) and this
// commit, which re-validates the raw rows itself rather than trusting the
// client-echoed preview — a category/supplier could have changed between
// the two calls. Bad rows are skipped and reported; one bad row never
// aborts the rest of the file.
export async function commitImport(rawRows, { branchId }, actorId, tenantId, user) {
  const branch = await branchRepository.findById(branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, branchId);
  if (!rawRows?.length) throw new ApiError(400, 'No rows to import');

  const { validRows, errors: validationErrors } = await validateRows(rawRows, tenantId);

  const errors = [...validationErrors];
  let medicinesCreated = 0;
  let batchesCreated = 0;
  const categoryCache = new Map();

  for (const row of validRows) {
    const outcome = await importRow(row, { tenantId, actorId, branchId }, categoryCache);
    if (outcome.ok) {
      medicinesCreated += 1;
      if (outcome.batchCreated) batchesCreated += 1;
    } else {
      errors.push(err(
        row.rowNumber,
        'Medicine Name',
        `Could not be imported: ${outcome.message}`,
        'A row that does not conflict with existing data',
      ));
    }
  }

  const rowsImported = medicinesCreated;
  const rowsSkipped = rawRows.length - rowsImported;

  if (rowsImported > 0) {
    await activityLogRepository.create({
      tenantId, userId: actorId, branchId,
      description: `${rowsImported} medicine${rowsImported === 1 ? '' : 's'} imported from Excel (${batchesCreated} with opening stock)`,
      referenceType: 'medicine_import', referenceId: null,
    });
  }

  return { rowsImported, medicinesCreated, batchesCreated, rowsSkipped, errors };
}
