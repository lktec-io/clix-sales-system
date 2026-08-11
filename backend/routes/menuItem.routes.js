import { Router } from 'express';
import * as menuItemController from '../controllers/menuItem.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { menuItemValidator } from '../validators/menuItem.validator.js';

const router = Router();

router.use(authenticate);

// Deliberately ungated by requireModule — the Order/POS builder's menu
// picker depends on this lookup, same exemption customer.routes.js/active
// and supplier.routes.js/active carry for their own dependent modules.
router.get('/active', menuItemController.listActive);

router.use(requireModule('menu'));

router.get('/', authorize('menu_items.view'), menuItemController.list);
router.get('/:id', authorize('menu_items.view'), menuItemController.getById);
router.post('/', authorize('menu_items.manage'), requireActiveTrial, menuItemValidator, validateRequest, menuItemController.create);
router.put('/:id', authorize('menu_items.manage'), requireActiveTrial, menuItemValidator, validateRequest, menuItemController.update);
router.delete('/:id', authorize('menu_items.manage'), requireActiveTrial, menuItemController.remove);

export default router;
