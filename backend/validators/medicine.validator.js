import { body } from 'express-validator';

export const medicineValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('categoryId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('unit').optional({ values: 'falsy' }).isLength({ max: 30 }),
  body('sellingPrice').isFloat({ gt: 0 }).withMessage('Selling price must be greater than zero'),
  body('reorderLevel').optional({ values: 'falsy' }).isInt({ min: 0 }),
  body('description').optional({ values: 'falsy' }).isLength({ max: 500 }),
];
