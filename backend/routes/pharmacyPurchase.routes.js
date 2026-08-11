import { Router } from 'express';
import * as pharmacyPurchaseController from '../controllers/pharmacyPurchase.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { pharmacyPurchaseValidator } from '../validators/pharmacyPurchase.validator.js';

const router = Router();

router.use(authenticate, authorize('pharmacy_purchases.view'), requireModule('pharmacy_purchases'));

router.get('/', pharmacyPurchaseController.list);
router.get('/:id', pharmacyPurchaseController.getById);
router.post('/', authorize('pharmacy_purchases.create'), requireActiveTrial, pharmacyPurchaseValidator, validateRequest, pharmacyPurchaseController.create);

export default router;
