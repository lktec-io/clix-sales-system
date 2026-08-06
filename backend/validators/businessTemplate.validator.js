import { body } from 'express-validator';

export const createTemplateValidator = [
  body('name').notEmpty().withMessage('Name is required').trim().isLength({ max: 100 }),
  body('slug').notEmpty().withMessage('Slug is required').trim().isSlug().withMessage('Slug must be lowercase, alphanumeric, and hyphen-separated'),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
];

export const updateTemplateValidator = [
  body('name').notEmpty().withMessage('Name is required').trim().isLength({ max: 100 }),
  body('slug').notEmpty().withMessage('Slug is required').trim().isSlug().withMessage('Slug must be lowercase, alphanumeric, and hyphen-separated'),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
];

export const duplicateTemplateValidator = [
  body('name').notEmpty().withMessage('Name is required').trim().isLength({ max: 100 }),
  body('slug').notEmpty().withMessage('Slug is required').trim().isSlug().withMessage('Slug must be lowercase, alphanumeric, and hyphen-separated'),
];

export const setModulesValidator = [
  body('modules').isArray({ min: 1 }).withMessage('modules must be a non-empty array'),
  body('modules.*.moduleId').isInt({ min: 1 }),
  body('modules.*.isEnabled').isBoolean(),
];

export const setDefaultSettingValidator = [
  body('key').notEmpty().withMessage('key is required').trim().isLength({ max: 100 }),
  body('value').optional({ values: 'null' }).isString().isLength({ max: 500 }),
  body('dataType').isIn(['string', 'number', 'boolean', 'json']).withMessage('Invalid dataType'),
];
