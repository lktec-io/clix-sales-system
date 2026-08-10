import { Router } from 'express';
import * as savingsController from '../controllers/savings.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { openSavingsAccountValidator, savingsTransactionValidator } from '../validators/savings.validator.js';

const router = Router();

router.use(authenticate, authorize('savings.view'), requireModule('savings'));

router.get('/', savingsController.list);
router.get('/:id', savingsController.getById);
router.get('/:id/transactions', savingsController.getTransactions);
router.post('/', authorize('savings.manage'), requireActiveTrial, openSavingsAccountValidator, validateRequest, savingsController.openAccount);
router.post('/:id/transactions', authorize('savings.manage'), requireActiveTrial, savingsTransactionValidator, validateRequest, savingsController.recordTransaction);

export default router;
