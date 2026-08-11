import { body } from 'express-validator';

const DEVICE_TYPES = ['smartphone', 'tablet', 'laptop', 'desktop', 'printer', 'other'];
const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'other'];

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
  body('deviceCondition').optional().isObject(),
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
