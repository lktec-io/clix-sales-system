import { Router } from 'express';
import * as loanGroupController from '../controllers/loanGroup.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { loanGroupValidator, loanGroupMemberValidator } from '../validators/loanGroup.validator.js';

const router = Router();

router.use(authenticate, authorize('borrower_groups.view'), requireModule('borrower_groups'));

router.get('/', loanGroupController.list);
router.get('/:id', loanGroupController.getById);
router.post('/', authorize('borrower_groups.manage'), requireActiveTrial, loanGroupValidator, validateRequest, loanGroupController.create);
router.put('/:id', authorize('borrower_groups.manage'), requireActiveTrial, loanGroupValidator, validateRequest, loanGroupController.update);
router.post('/:id/members', authorize('borrower_groups.manage'), requireActiveTrial, loanGroupMemberValidator, validateRequest, loanGroupController.addMember);
router.delete('/:id/members/:customerId', authorize('borrower_groups.manage'), requireActiveTrial, loanGroupController.removeMember);

export default router;
