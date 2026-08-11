import { body } from 'express-validator';

export const menuItemValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('categoryId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('sellingPrice').isFloat({ min: 0.01 }).withMessage('Selling price must be greater than zero'),
  body('description').optional({ values: 'falsy' }).isLength({ max: 500 }),
  body('imageUrl').optional({ values: 'falsy' }).isLength({ max: 500 }),
  body('isAvailable').optional().isBoolean(),
];
