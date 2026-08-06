import { Router } from 'express';
import * as transferController from '../controllers/transfer.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { createTransferValidator } from '../validators/transfer.validator.js';

const router = Router();

router.use(authenticate, authorize('transfers.view'), requireModule('transfers'));

router.get('/', transferController.list);
router.get('/:id', transferController.getById);
router.post('/', authorize('transfers.create'), requireActiveTrial, createTransferValidator, validateRequest, transferController.create);
router.post('/:id/approve', authorize('transfers.approve'), requireActiveTrial, transferController.approve);
router.post('/:id/reject', authorize('transfers.approve'), requireActiveTrial, transferController.reject);

export default router;
