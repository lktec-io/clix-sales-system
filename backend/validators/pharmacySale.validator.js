import { body } from 'express-validator';

export const pharmacySaleValidator = [
  body('branchId').isInt({ min: 1 }).withMessage('Branch is required'),
  body('customerId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('paymentMethod').optional({ values: 'falsy' }).isIn(['cash', 'mobile_money', 'bank_transfer', 'card', 'other']),
  body('items').isArray({ min: 1 }).withMessage('Add at least one medicine to the sale'),
  body('items.*.medicineId').isInt({ min: 1 }).withMessage('Medicine is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];
