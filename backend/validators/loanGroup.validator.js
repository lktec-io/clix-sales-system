import { body } from 'express-validator';

export const loanGroupValidator = [
  body('name').trim().notEmpty().withMessage('Group name is required').isLength({ max: 150 }),
  body('leaderCustomerId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('status').optional({ values: 'falsy' }).isIn(['active', 'inactive']),
];

export const loanGroupMemberValidator = [
  body('customerId').isInt({ min: 1 }).withMessage('Customer is required'),
];
