import { Router } from 'express';
import * as loanController from '../controllers/loan.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  loanApplicationValidator, loanApproveValidator, loanRejectValidator, loanGuarantorValidator,
} from '../validators/loan.validator.js';

const router = Router();

router.use(authenticate, authorize('loans.view'), requireModule('loans'));

// Registered before '/:id' — a numeric-looking segment here would otherwise
// be swallowed by the ':id' route and 404 via Number('kpis') (see Phase
// 5.1's product.routes.js /archived-vs-/:id fix for the exact failure shape
// this ordering avoids).
router.get('/kpis', loanController.portfolioKpis);

router.get('/', loanController.list);
router.get('/:id', loanController.getById);
router.post('/', authorize('loans.create'), requireActiveTrial, loanApplicationValidator, validateRequest, loanController.apply);
router.post('/:id/review', authorize('loans.approve'), requireActiveTrial, loanController.markUnderReview);
router.post('/:id/approve', authorize('loans.approve'), requireActiveTrial, loanApproveValidator, validateRequest, loanController.approve);
router.post('/:id/reject', authorize('loans.approve'), requireActiveTrial, loanRejectValidator, validateRequest, loanController.reject);
router.post('/:id/disburse', authorize('loans.disburse'), requireActiveTrial, loanController.disburse);
router.post('/:id/write-off', authorize('loans.manage'), requireActiveTrial, loanController.writeOff);
router.post('/:id/guarantors', authorize('loans.manage'), requireActiveTrial, loanGuarantorValidator, validateRequest, loanController.addGuarantor);

export default router;
