import { body } from 'express-validator';

const DEVICE_TYPES = ['smartphone', 'tablet', 'laptop', 'desktop', 'printer', 'other'];
const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'other'];

// Mirrors RepairIntakeForm.jsx's CONDITION_FIELDS exactly — each condition
// field's own <select> is restricted to this option set, so an unvalidated
// value here would render as a raw, untranslated i18n key on RepairDetail.
const CONDITION_FIELD_OPTIONS = {
  screen: ['good', 'scratched', 'cracked', 'broken'],
  body: ['good', 'scratched', 'dented', 'broken'],
  backCover: ['good', 'scratched', 'cracked', 'missing'],
  camera: ['working', 'faulty', 'damaged'],
  chargingPort: ['working', 'faulty', 'damaged'],
  buttons: ['working', 'faulty', 'damaged'],
  battery: ['good', 'weak', 'swollen', 'faulty'],
};

function isValidDeviceCondition(value) {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, val]) => {
    if (key === 'notes') return typeof val === 'string';
    const allowed = CONDITION_FIELD_OPTIONS[key];
    return allowed ? allowed.includes(val) : false;
  });
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
  body('deviceCondition').optional().isObject().custom(isValidDeviceCondition).withMessage('Invalid device condition value'),
  body('accessoriesReceived').optional().isObject(),
  body('expectedCompletionAt').optional({ values: 'falsy' }).isISO8601(),
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
