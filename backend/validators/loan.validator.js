import { body } from 'express-validator';

// loanProductId is optional — the simplified Microfinance workflow enters
// interestRate/durationValue/durationUnit directly on the loan instead of
// selecting a pre-configured product. Shape-only checks here; which set of
// fields is actually required (product vs. direct terms) is a business
// rule decided in loan.service.js#applyForLoan(), the same "validator does
// shape, service does business rules" split resolveSelectedTemplateId()
// already established.
export const loanApplicationValidator = [
  body('customerId').isInt({ min: 1 }).withMessage('Borrower is required'),
  body('branchId').isInt({ min: 1 }).withMessage('Branch is required'),
  body('requestedAmount').isFloat({ gt: 0 }).withMessage('Loan amount must be greater than zero'),
  body('loanProductId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('interestRate').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Interest rate must be zero or greater'),
  body('durationValue').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Duration must be at least 1'),
  body('durationUnit').optional({ values: 'falsy' }).isIn(['days', 'weeks', 'months']).withMessage('Invalid duration unit'),
  body('startDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid start date'),
  body('purpose').optional({ values: 'falsy' }).isLength({ max: 255 }),
  body('guarantors').optional().isArray(),
  body('guarantors.*.guarantorName').if(body('guarantors').exists()).trim().notEmpty().withMessage('Guarantor name is required'),
  body('guarantors.*.guaranteedAmount').if(body('guarantors').exists()).isFloat({ gt: 0 }).withMessage('Guaranteed amount must be greater than zero'),
];

export const loanApproveValidator = [
  body('approvedAmount').optional({ values: 'falsy' }).isFloat({ gt: 0 }).withMessage('Approved amount must be greater than zero'),
];

export const loanRejectValidator = [
  body('rejectionReason').optional({ values: 'falsy' }).isLength({ max: 255 }),
];

export const loanGuarantorValidator = [
  body('guarantorName').trim().notEmpty().withMessage('Guarantor name is required').isLength({ max: 150 }),
  body('guarantorPhone').optional({ values: 'falsy' }).isLength({ max: 30 }),
  body('customerId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('guaranteedAmount').isFloat({ gt: 0 }).withMessage('Guaranteed amount must be greater than zero'),
];

export const loanRepaymentValidator = [
  body('loanId').isInt({ min: 1 }).withMessage('Loan is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
  body('paymentDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date'),
  body('paymentMethod').isIn(['cash', 'mobile_money', 'bank_transfer', 'cheque', 'other']).withMessage('Invalid payment method'),
  body('reference').optional({ values: 'falsy' }).isLength({ max: 100 }),
];
