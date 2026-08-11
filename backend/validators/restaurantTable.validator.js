import { body } from 'express-validator';

export const restaurantTableValidator = [
  body('branchId').isInt({ min: 1 }).withMessage('Branch is required'),
  body('tableNumber').trim().notEmpty().withMessage('Table number is required').isLength({ max: 30 }),
  body('capacity').optional({ values: 'falsy' }).isInt({ min: 1 }),
];

export const restaurantTableStatusValidator = [
  body('status').isIn(['available', 'reserved']).withMessage('Status must be available or reserved'),
];
