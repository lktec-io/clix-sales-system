import { Router } from 'express';
import * as pharmacySaleController from '../controllers/pharmacySale.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { pharmacySaleValidator } from '../validators/pharmacySale.validator.js';

const router = Router();

router.use(authenticate, authorize('pharmacy_sales.view'), requireModule('pharmacy_sales'));

router.get('/summary', pharmacySaleController.summary);
router.get('/recent', pharmacySaleController.recent);
router.get('/', pharmacySaleController.list);
router.get('/:id', pharmacySaleController.getById);
router.get('/:id/receipt', pharmacySaleController.receipt);
router.post('/', authorize('pharmacy_sales.create'), requireActiveTrial, pharmacySaleValidator, validateRequest, pharmacySaleController.create);

export default router;
