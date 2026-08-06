import { Router } from 'express';
import * as customerController from '../controllers/customer.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { customerValidator, changeStatusValidator } from '../validators/customer.validator.js';

const router = Router();

router.use(authenticate);

// Deliberately ungated by requireModule — Sales' customer-select depends on
// this lookup regardless of whether the Customers module itself is
// enabled, same reasoning branches.routes.js's /active lookup is exempt.
router.get('/active', customerController.listActive);

router.use(requireModule('customers'));

router.get('/', authorize('customers.view'), customerController.list);
router.get('/:id', authorize('customers.view'), customerController.getById);
router.get('/:id/purchases', authorize('customers.view'), customerController.purchaseHistory);
router.get('/:id/returns', authorize('customers.view'), customerController.returnHistory);
router.post('/', authorize('customers.create'), customerValidator, validateRequest, customerController.create);
router.put('/:id', authorize('customers.edit'), customerValidator, validateRequest, customerController.update);
router.patch('/:id/status', authorize('customers.edit'), changeStatusValidator, validateRequest, customerController.changeStatus);
router.delete('/:id', authorize('customers.delete'), customerController.remove);

export default router;
