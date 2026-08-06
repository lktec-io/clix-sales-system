import { Router } from 'express';
import * as returnController from '../controllers/return.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { createReturnValidator } from '../validators/return.validator.js';

const router = Router();

router.use(authenticate, authorize('returns.view'), requireModule('returns'));

router.get('/', returnController.list);
router.get('/:id', returnController.getById);
router.post('/', authorize('returns.create'), createReturnValidator, validateRequest, returnController.create);
router.post('/:id/approve', authorize('returns.approve'), returnController.approve);
router.post('/:id/reject', authorize('returns.approve'), returnController.reject);

export default router;
