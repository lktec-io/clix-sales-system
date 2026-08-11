import { Router } from 'express';
import * as restaurantOrderController from '../controllers/restaurantOrder.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { restaurantOrderValidator, restaurantOrderPaymentValidator } from '../validators/restaurantOrder.validator.js';

const router = Router();

router.use(authenticate, requireModule('restaurant_orders'));

router.get('/summary', authorize('restaurant_orders.view'), restaurantOrderController.summary);
router.get('/recent', authorize('restaurant_orders.view'), restaurantOrderController.recent);
router.get('/', authorize('restaurant_orders.view'), restaurantOrderController.list);
router.get('/:id', authorize('restaurant_orders.view'), restaurantOrderController.getById);
router.post('/', authorize('restaurant_orders.create'), requireActiveTrial, restaurantOrderValidator, validateRequest, restaurantOrderController.create);
router.post('/:id/send-to-kitchen', authorize('restaurant_orders.manage'), requireActiveTrial, restaurantOrderController.sendToKitchen);
router.post('/:id/serve', authorize('restaurant_orders.manage'), requireActiveTrial, restaurantOrderController.markServed);
router.post('/:id/payment', authorize('restaurant_orders.manage'), requireActiveTrial, restaurantOrderPaymentValidator, validateRequest, restaurantOrderController.recordPayment);
router.post('/:id/cancel', authorize('restaurant_orders.manage'), requireActiveTrial, restaurantOrderController.cancel);

export default router;
