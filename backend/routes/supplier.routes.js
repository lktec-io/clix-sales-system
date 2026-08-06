import { Router } from 'express';
import * as supplierController from '../controllers/supplier.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { supplierValidator, changeStatusValidator } from '../validators/supplier.validator.js';

const router = Router();

router.use(authenticate);

// Deliberately ungated by requireModule — Purchases' supplier-select
// depends on this lookup regardless of whether the Suppliers module
// itself is enabled, same reasoning branches.routes.js's /active lookup
// is exempt.
router.get('/active', supplierController.listActive);

router.use(requireModule('suppliers'));

router.get('/', authorize('suppliers.view'), supplierController.list);
router.get('/:id', authorize('suppliers.view'), supplierController.getById);
router.get('/:id/purchases', authorize('suppliers.view'), supplierController.purchaseHistory);
router.post('/', authorize('suppliers.create'), supplierValidator, validateRequest, supplierController.create);
router.put('/:id', authorize('suppliers.edit'), supplierValidator, validateRequest, supplierController.update);
router.patch('/:id/status', authorize('suppliers.edit'), changeStatusValidator, validateRequest, supplierController.changeStatus);
router.delete('/:id', authorize('suppliers.delete'), supplierController.remove);

export default router;
