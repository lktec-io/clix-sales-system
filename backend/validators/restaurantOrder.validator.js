import { body } from 'express-validator';

export const restaurantOrderValidator = [
  body('branchId').isInt({ min: 1 }).withMessage('Branch is required'),
  body('tableId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('customerId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('items').isArray({ min: 1 }).withMessage('Add at least one menu item to the order'),
  body('items.*.menuItemId').isInt({ min: 1 }).withMessage('Menu item is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

export const restaurantOrderPaymentValidator = [
  body('paymentMethod').isIn(['cash', 'mobile_money', 'bank_transfer', 'card', 'other']).withMessage('Invalid payment method'),
];

export const kitchenItemStatusValidator = [
  body('kitchenStatus').isIn(['preparing', 'ready']).withMessage('Kitchen status can only be set to preparing or ready'),
];
