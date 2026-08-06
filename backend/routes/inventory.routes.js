import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { adjustmentValidator } from '../validators/inventory.validator.js';

const router = Router();

router.use(authenticate, authorize('inventory.view'), requireModule('inventory'));

router.get('/', inventoryController.list);
router.get('/summary', inventoryController.summary);
router.get('/movements', inventoryController.movements);
router.post('/adjustments', authorize('inventory.adjust'), requireActiveTrial, adjustmentValidator, validateRequest, inventoryController.createAdjustment);

export default router;
