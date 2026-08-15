import { body } from 'express-validator';

export const medicineValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('barcode').optional({ values: 'falsy' }).trim().isLength({ max: 64 }),
  body('categoryId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('unit').optional({ values: 'falsy' }).isLength({ max: 30 }),
  body('sellingPrice').isFloat({ gt: 0 }).withMessage('Selling price must be greater than zero'),
  body('reorderLevel').optional({ values: 'falsy' }).isInt({ min: 0 }),
  body('description').optional({ values: 'falsy' }).isLength({ max: 500 }),
  // Real validation of these (required-together-if-quantity>0) happens in
  // medicine.service.js#createMedicine, same convention as
  // medicineImportCommitValidator below — this is just a shape/type sanity
  // check, not the source of truth for the conditional business rule.
  body('initialStock').optional().isObject(),
  body('initialStock.quantity').optional({ values: 'falsy' }).isInt({ min: 0 }),
  body('initialStock.buyingPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('initialStock.batchNumber').optional({ values: 'falsy' }).isString().isLength({ max: 60 }),
  body('initialStock.expiryDate').optional({ values: 'falsy' }).isISO8601(),
  body('initialStock.branchId').optional({ values: 'falsy' }).isInt({ min: 1 }),
];

// Mirrors purchase.validator.js#commitImportValidator — the request-shape
// sanity check for the "Import Medicines" commit call. Real per-field
// validation (Selling Price, Expiry Date, etc.) happens server-side in
// medicineImport.service.js#validateRows, which runs again here regardless
// of what the client echoes back from preview.
export const medicineImportCommitValidator = [
  body('branchId').notEmpty().withMessage('Branch is required').isInt(),
  body('rows').isArray({ min: 1 }).withMessage('No rows to import'),
  body('rows.*.rowNumber').isInt(),
  body('rows.*.medicineName').optional({ values: 'falsy' }).isString(),
];
