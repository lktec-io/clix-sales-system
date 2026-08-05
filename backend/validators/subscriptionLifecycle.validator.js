import { body } from 'express-validator';

const CYCLES = ['monthly', 'quarterly', 'yearly'];

export const changePlanValidator = [
  body('planId').isInt({ min: 1 }).withMessage('planId is required'),
  body('billingCycle').isIn(CYCLES).withMessage('billingCycle must be monthly, quarterly, or yearly'),
];

export const cancelValidator = [
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

export const scheduleChangeValidator = [
  body('planId').isInt({ min: 1 }).withMessage('planId is required'),
  body('billingCycle').isIn(CYCLES).withMessage('billingCycle must be monthly, quarterly, or yearly'),
  body('effectiveDate').isISO8601().withMessage('effectiveDate must be a valid date').custom((value) => new Date(value) > new Date())
    .withMessage('effectiveDate must be in the future'),
];
