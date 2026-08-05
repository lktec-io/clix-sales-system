import { Router } from 'express';
import * as saleController from '../controllers/sale.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { checkoutValidator } from '../validators/sale.validator.js';

const router = Router();

router.use(authenticate, authorize('sales.view'));

router.get('/', saleController.list);
router.get('/:id', saleController.getById);
router.get('/:id/receipt', saleController.receipt);
router.post('/', authorize('sales.create'), requireActiveTrial, checkoutValidator, validateRequest, saleController.checkout);

export default router;
