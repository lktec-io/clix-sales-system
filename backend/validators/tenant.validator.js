import { body } from 'express-validator';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';

export const registerValidator = [
  body('companyName').trim().notEmpty().withMessage('Company name is required').isLength({ max: 150 }),
  body('ownerFirstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 100 }),
  body('ownerLastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 100 }),
  body('businessEmail').trim().isEmail().withMessage('Enter a valid business email').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ max: 20 }),
  body('password').custom((value) => isStrongPassword(value)).withMessage(PASSWORD_POLICY_MESSAGE),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  body('acceptTerms')
    .custom((value) => value === true)
    .withMessage('You must accept the Terms of Service to continue'),
  body('businessType').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('country').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  // Shape-only check — optional, must be a positive integer if present.
  // Existence + active-status validation happens in
  // businessTemplateAssignmentService.resolveSelectedTemplateId(), which
  // needs a DB lookup and runs from the controller before registration.
  body('businessTemplateId').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Invalid business type selected'),
  // Honeypot — hidden from real users via CSS in Register.jsx, never
  // populated by a human. A bot's generic form-filler that blanket-fills
  // every field trips this and fails validation the same as any other bad
  // submission, with no special-casing needed anywhere else.
  body('website').optional({ values: 'falsy' }).isEmpty().withMessage('Invalid submission'),
];
