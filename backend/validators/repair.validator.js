import { body } from 'express-validator';

const DEVICE_TYPES = ['smartphone', 'tablet', 'laptop', 'desktop', 'printer', 'other'];
const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'other'];

// Mirrors RepairIntakeForm.jsx's CONDITION_OPTIONS/ACCESSORY_OPTIONS chip
// lists exactly — device_condition/accessories_received are JSON columns
// with no rigid SQL shape, so this application-level allow-list is the only
// thing standing between a request and an unvalidated value rendering as a
// raw, untranslated i18n key on Repair Detail.
const CONDITION_OPTIONS = ['good', 'scratched', 'cracked_screen', 'broken_body', 'water_damage', 'no_power', 'missing_parts', 'other'];
const ACCESSORY_OPTIONS = ['charger', 'cable', 'sim_card', 'memory_card', 'case', 'bag', 'none', 'other'];

// { conditions: string[], notes?: string } — a flat multi-select chip list
// rather than a per-component checklist, so intake stays fast: the
// technician taps every applicable chip instead of setting 7 separate
// dropdowns one at a time.
function isValidDeviceCondition(value) {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (value.conditions !== undefined && (!Array.isArray(value.conditions) || !value.conditions.every((c) => CONDITION_OPTIONS.includes(c)))) return false;
  if (value.notes !== undefined && typeof value.notes !== 'string') return false;
  return true;
}

function isValidAccessoriesReceived(value) {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every((a) => ACCESSORY_OPTIONS.includes(a));
}

export const repairIntakeValidator = [
  body('branchId').isInt({ min: 1 }).withMessage('Branch is required'),
  body('customerId').isInt({ min: 1 }).withMessage('Customer is required'),
  body('technicianId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('deviceType').isIn(DEVICE_TYPES).withMessage('Invalid device type'),
  body('brand').trim().notEmpty().withMessage('Brand is required').isLength({ max: 100 }),
  body('model').trim().notEmpty().withMessage('Model is required').isLength({ max: 100 }),
  body('serialNumber').optional({ values: 'falsy' }).isLength({ max: 100 }),
  body('imei1').optional({ values: 'falsy' }).isLength({ max: 20 }),
  body('imei2').optional({ values: 'falsy' }).isLength({ max: 20 }),
  body('deviceColor').optional({ values: 'falsy' }).isLength({ max: 50 }),
  body('reportedProblem').trim().notEmpty().withMessage('Reported problem is required').isLength({ max: 1000 }),
  body('estimatedCost').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('deviceCondition').optional().isObject().custom(isValidDeviceCondition).withMessage('Invalid device condition value'),
  body('accessoriesReceived').optional().custom(isValidAccessoriesReceived).withMessage('Invalid accessories received value'),
  body('expectedCompletionAt').optional({ values: 'falsy' }).isISO8601(),
  body('depositAmount').optional({ values: 'falsy' }).isFloat({ min: 0.01 }),
  body('depositPaymentMethod').if(body('depositAmount').exists({ values: 'falsy' })).isIn(PAYMENT_METHODS).withMessage('Invalid deposit payment method'),
];

export const repairDiagnosisValidator = [
  body('diagnosis').optional({ values: 'falsy' }).isLength({ max: 1000 }),
  body('repairNotes').optional({ values: 'falsy' }).isLength({ max: 1000 }),
  body('laborCharge').optional({ values: 'falsy' }).isFloat({ min: 0 }),
];

export const repairTechnicianValidator = [
  body('technicianId').isInt({ min: 1 }).withMessage('Technician is required'),
];

export const repairPartValidator = [
  body('productId').isInt({ min: 1 }).withMessage('Product is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

export const repairPaymentValidator = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than zero'),
  body('paymentMethod').isIn(PAYMENT_METHODS).withMessage('Invalid payment method'),
];

export const repairNotesValidator = [
  body('notes').optional({ values: 'falsy' }).isLength({ max: 500 }),
];

export const repairMessageValidator = [
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 480 }),
];
