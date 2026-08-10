import { body } from 'express-validator';

export const loanProductValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('minAmount').isFloat({ gt: 0 }).withMessage('Minimum amount must be greater than zero'),
  body('maxAmount').isFloat({ gt: 0 }).withMessage('Maximum amount must be greater than zero'),
  body('interestRate').isFloat({ min: 0 }).withMessage('Interest rate must be zero or greater'),
  body('interestMethod').isIn(['flat', 'reducing']).withMessage('Invalid interest method'),
  body('durationValue').isInt({ min: 1 }).withMessage('Duration must be at least 1'),
  body('durationUnit').isIn(['days', 'weeks', 'months']).withMessage('Invalid duration unit'),
  body('repaymentFrequency').isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid repayment frequency'),
  body('processingFeePercent').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Processing fee must be zero or greater'),
];

export const loanProductStatusValidator = [
  body('status').isIn(['active', 'inactive']).withMessage('Invalid status'),
];
