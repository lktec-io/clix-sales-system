import { body } from 'express-validator';

export const createModuleValidator = [
  body('key').notEmpty().withMessage('Key is required').trim().isSlug().withMessage('Key must be lowercase, alphanumeric, and hyphen-separated'),
  body('name').notEmpty().withMessage('Name is required').trim().isLength({ max: 100 }),
  body('icon').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
  body('route').optional({ values: 'falsy' }).isString().isLength({ max: 150 }),
  body('requiredPermission').optional({ values: 'falsy' }).isString().isLength({ max: 255 }),
  body('navigationOrder').optional().isInt(),
];

export const updateModuleValidator = [
  body('name').notEmpty().withMessage('Name is required').trim().isLength({ max: 100 }),
  body('icon').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
  body('route').optional({ values: 'falsy' }).isString().isLength({ max: 150 }),
  body('requiredPermission').optional({ values: 'falsy' }).isString().isLength({ max: 255 }),
  body('navigationOrder').optional().isInt(),
];
