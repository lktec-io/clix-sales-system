import { body } from 'express-validator';

const CYCLES = ['monthly', 'quarterly', 'yearly'];

export const checkoutValidator = [
  body('planId').isInt({ min: 1 }).withMessage('planId is required'),
  body('billingCycle').isIn(CYCLES).withMessage('billingCycle must be monthly, quarterly, or yearly'),
];

export const rejectPaymentValidator = [
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];
