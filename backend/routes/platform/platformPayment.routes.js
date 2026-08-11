import { Router } from 'express';
import * as paymentController from '../../controllers/payment.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { rejectPaymentValidator } from '../../validators/payment.validator.js';

const router = Router();
router.use(authenticatePlatform);

router.get('/', paymentController.listForPlatform);
router.get('/:paymentId', paymentController.getForPlatform);
router.post('/:paymentId/confirm', paymentController.confirmManually);
router.post('/:paymentId/reject', rejectPaymentValidator, validateRequest, paymentController.rejectManually);

export default router;
