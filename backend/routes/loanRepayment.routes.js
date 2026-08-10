import { Router } from 'express';
import * as loanRepaymentController from '../controllers/loanRepayment.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { loanRepaymentValidator } from '../validators/loan.validator.js';

const router = Router();

router.use(authenticate, authorize('loan_repayments.view'), requireModule('loan_repayments'));

router.get('/', loanRepaymentController.list);
router.post('/', authorize('loan_repayments.create'), requireActiveTrial, loanRepaymentValidator, validateRequest, loanRepaymentController.create);

export default router;
