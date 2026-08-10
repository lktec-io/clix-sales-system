import { Router } from 'express';
import * as loanProductController from '../controllers/loanProduct.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { loanProductValidator, loanProductStatusValidator } from '../validators/loanProduct.validator.js';

const router = Router();

router.use(authenticate, authorize('loan_products.view'), requireModule('loan_products'));

router.get('/active', loanProductController.listActive);
router.get('/', loanProductController.list);
router.get('/:id', loanProductController.getById);
router.post('/', authorize('loan_products.manage'), requireActiveTrial, loanProductValidator, validateRequest, loanProductController.create);
router.put('/:id', authorize('loan_products.manage'), requireActiveTrial, loanProductValidator, validateRequest, loanProductController.update);
router.patch('/:id/status', authorize('loan_products.manage'), requireActiveTrial, loanProductStatusValidator, validateRequest, loanProductController.setStatus);
router.delete('/:id', authorize('loan_products.manage'), requireActiveTrial, loanProductController.remove);

export default router;
