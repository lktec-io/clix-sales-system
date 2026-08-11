import { body } from 'express-validator';

export const pharmacyPurchaseValidator = [
  body('supplierId').isInt({ min: 1 }).withMessage('Supplier is required'),
  body('branchId').isInt({ min: 1 }).withMessage('Branch is required'),
  body('reference').optional({ values: 'falsy' }).isLength({ max: 100 }),
  body('purchaseDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid purchase date'),
  body('items').isArray({ min: 1 }).withMessage('Add at least one medicine to the purchase'),
  body('items.*.medicineId').isInt({ min: 1 }).withMessage('Medicine is required'),
  body('items.*.batchNumber').trim().notEmpty().withMessage('Batch number is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.buyingPrice').isFloat({ min: 0 }).withMessage('Buying price cannot be negative'),
  body('items.*.sellingPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('items.*.expiryDate').isISO8601().withMessage('Expiry date is required'),
];
