import { body } from 'express-validator';

const CYCLES = ['monthly', 'quarterly', 'yearly'];

export const checkoutValidator = [
  body('planId').isInt({ min: 1 }).withMessage('planId is required'),
  body('billingCycle').isIn(CYCLES).withMessage('billingCycle must be monthly, quarterly, or yearly'),
  // Only required by providers that need a push-to-phone flow (e.g.
  // AzamPay's MNO checkout) — the manual provider ignores both. Format
  // checked generically here; which network values are actually valid is
  // provider-specific and enforced inside that provider's own
  // createCheckout() (Step 7 — keep provider terminology in the adapter).
  body('phoneNumber').optional({ values: 'falsy' }).trim().isLength({ min: 9, max: 15 }).withMessage('Enter a valid phone number'),
  body('mnoNetwork').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
];

export const rejectPaymentValidator = [
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];
