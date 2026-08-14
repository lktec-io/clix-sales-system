import { Router } from 'express';
import * as subscriptionPlanController from '../controllers/subscriptionPlan.controller.js';
import * as tenantSubscriptionController from '../controllers/tenantSubscription.controller.js';
import * as invoiceController from '../controllers/invoice.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { checkoutValidator } from '../validators/payment.validator.js';

const router = Router();

// Deliberately registered BEFORE router.use(authenticate) below — the
// public landing page (an unauthenticated visitor) needs the real active
// plan list/pricing to display, and subscriptionPlanService.listPublicPlans()
// already returns only marketing-safe fields (name, price, features,
// currency — never anything tenant-specific). Every other route in this
// file is registered after the authenticate() call and stays protected.
router.get('/plans', subscriptionPlanController.listPublic);

router.use(authenticate);

// Every endpoint below is scoped to req.user.tenantId — never a
// client-supplied id — so a tenant can only ever see their own
// subscription, invoices, and billing history (Step 12).
router.get('/me/subscription', tenantSubscriptionController.getMySubscription);
router.get('/me/history', tenantSubscriptionController.getMyHistory);
router.get('/me/invoices', invoiceController.listMine);
router.get('/me/invoices/:id', invoiceController.getMine);
router.get('/me/invoices/:id/pdf', invoiceController.downloadMinePdf);
router.get('/me/payments', paymentController.listMine);
router.get('/payment-methods', paymentController.getPaymentMethods);
router.post('/checkout', checkoutValidator, validateRequest, paymentController.checkout);

export default router;
