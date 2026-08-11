import { Router } from 'express';
import * as restaurantTableController from '../controllers/restaurantTable.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { restaurantTableValidator, restaurantTableStatusValidator } from '../validators/restaurantTable.validator.js';

const router = Router();

router.use(authenticate);

// Deliberately ungated by requireModule — the Order/POS builder's table
// picker depends on this lookup, same exemption menu_items/active carries.
router.get('/available', restaurantTableController.listAvailable);

router.use(requireModule('tables'));

router.get('/summary', authorize('restaurant_tables.view'), restaurantTableController.summary);
router.get('/', authorize('restaurant_tables.view'), restaurantTableController.list);
router.get('/:id', authorize('restaurant_tables.view'), restaurantTableController.getById);
router.post('/', authorize('restaurant_tables.manage'), requireActiveTrial, restaurantTableValidator, validateRequest, restaurantTableController.create);
router.put('/:id', authorize('restaurant_tables.manage'), requireActiveTrial, restaurantTableValidator, validateRequest, restaurantTableController.update);
router.patch('/:id/active', authorize('restaurant_tables.manage'), requireActiveTrial, restaurantTableController.setActive);
router.patch('/:id/status', authorize('restaurant_tables.manage'), requireActiveTrial, restaurantTableStatusValidator, validateRequest, restaurantTableController.setStatus);

export default router;
