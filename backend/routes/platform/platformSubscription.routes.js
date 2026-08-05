import { Router } from 'express';
import * as invoiceController from '../../controllers/invoice.controller.js';
import * as subscriptionLifecycleController from '../../controllers/subscriptionLifecycle.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { changePlanValidator, cancelValidator, scheduleChangeValidator } from '../../validators/subscriptionLifecycle.validator.js';

const router = Router();
router.use(authenticatePlatform);

// Static /invoices routes declared before the dynamic /:tenantId routes
// below, so Express never mistakes "invoices" for a tenantId segment.
router.get('/invoices', invoiceController.listForPlatform);
router.get('/invoices/:invoiceId', invoiceController.getForPlatform);
router.get('/invoices/:invoiceId/pdf', invoiceController.downloadPlatformPdf);
router.post('/invoices/:invoiceId/mark-paid', invoiceController.markPaid);

router.get('/:tenantId', subscriptionLifecycleController.getForTenant);
router.get('/:tenantId/history', subscriptionLifecycleController.getHistoryForTenant);
router.post('/:tenantId/upgrade', changePlanValidator, validateRequest, subscriptionLifecycleController.upgrade);
router.post('/:tenantId/downgrade', changePlanValidator, validateRequest, subscriptionLifecycleController.downgrade);
router.post('/:tenantId/renew', subscriptionLifecycleController.renew);
router.post('/:tenantId/cancel', cancelValidator, validateRequest, subscriptionLifecycleController.cancel);
router.post('/:tenantId/resume', subscriptionLifecycleController.resume);
router.post('/:tenantId/schedule', scheduleChangeValidator, validateRequest, subscriptionLifecycleController.schedule);
router.post('/:tenantId/invoices', subscriptionLifecycleController.generateInvoiceForTenant);

export default router;
