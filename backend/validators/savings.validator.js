import { body } from 'express-validator';

export const openSavingsAccountValidator = [
  body('customerId').isInt({ min: 1 }).withMessage('Customer is required'),
];

export const savingsTransactionValidator = [
  body('branchId').isInt({ min: 1 }).withMessage('Branch is required'),
  body('type').isIn(['deposit', 'withdrawal']).withMessage('Invalid transaction type'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
  body('reference').optional({ values: 'falsy' }).isLength({ max: 100 }),
];
