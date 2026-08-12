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

export const deleteTenantValidator = [
  body('confirmCompanyName').trim().notEmpty().withMessage('Type the company name to confirm deletion'),
];

export const setBusinessTemplateValidator = [
  body('businessTemplateId').isInt({ min: 1 }).withMessage('businessTemplateId is required'),
];

export const setModuleOverrideValidator = [
  body('moduleId').isInt({ min: 1 }).withMessage('moduleId is required'),
  body('isEnabled').custom((value) => value === null || typeof value === 'boolean').withMessage('isEnabled must be a boolean or null'),
];
