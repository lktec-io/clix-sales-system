import { Router } from 'express';
import * as subscriptionPlanController from '../controllers/subscriptionPlan.controller.js';
import * as tenantSubscriptionController from '../controllers/tenantSubscription.controller.js';
import * as invoiceController from '../controllers/invoice.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = Router();
router.use(authenticate);

// Every endpoint below is scoped to req.user.tenantId — never a
// client-supplied id — so a tenant can only ever see their own
// subscription, invoices, and billing history (Step 12).
router.get('/plans', subscriptionPlanController.listPublic);
router.get('/me/subscription', tenantSubscriptionController.getMySubscription);
router.get('/me/history', tenantSubscriptionController.getMyHistory);
router.get('/me/invoices', invoiceController.listMine);
router.get('/me/invoices/:id', invoiceController.getMine);
router.get('/me/invoices/:id/pdf', invoiceController.downloadMinePdf);

export default router;
