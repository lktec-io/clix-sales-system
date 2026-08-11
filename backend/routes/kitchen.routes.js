import { Router } from 'express';
import * as kitchenController from '../controllers/kitchen.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { kitchenItemStatusValidator } from '../validators/restaurantOrder.validator.js';

const router = Router();

router.use(authenticate, requireModule('kitchen'));

router.get('/queue', authorize('kitchen.view'), kitchenController.queue);
router.patch('/items/:itemId/status', authorize('kitchen.manage'), requireActiveTrial, kitchenItemStatusValidator, validateRequest, kitchenController.updateItemStatus);

export default router;
