import { body } from 'express-validator';

const planFieldsValidator = [
  body('name').notEmpty().withMessage('Plan name is required').trim().isLength({ max: 100 }),
  body('slug').notEmpty().withMessage('Slug is required').trim().isSlug().withMessage('Slug must be lowercase, alphanumeric, and hyphen-separated'),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  body('priceMonthly').isFloat({ min: 0 }).withMessage('Monthly price must be zero or positive'),
  body('priceQuarterly').isFloat({ min: 0 }).withMessage('Quarterly price must be zero or positive'),
  body('priceYearly').isFloat({ min: 0 }).withMessage('Yearly price must be zero or positive'),
  body('currency').optional({ values: 'falsy' }).isString().isLength({ max: 10 }),
];

export const createPlanValidator = planFieldsValidator;
export const updatePlanValidator = planFieldsValidator;

export const reorderValidator = [
  body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds must be a non-empty array'),
  body('orderedIds.*').isInt().withMessage('Each id must be an integer'),
];
