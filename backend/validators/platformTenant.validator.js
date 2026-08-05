import { body } from 'express-validator';

export const trialDaysValidator = [
  body('days').isInt({ min: 1, max: 365 }).withMessage('Days must be a whole number between 1 and 365'),
];

export const resetTrialValidator = [
  body('days').optional({ values: 'falsy' }).isInt({ min: 1, max: 365 }).withMessage('Days must be a whole number between 1 and 365'),
];

export const suspendValidator = [
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];
