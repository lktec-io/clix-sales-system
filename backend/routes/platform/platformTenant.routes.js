import { Router } from 'express';
import * as platformTenantController from '../../controllers/platformTenant.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { trialDaysValidator, resetTrialValidator, suspendValidator } from '../../validators/platformTenant.validator.js';

const router = Router();

router.use(authenticatePlatform);

router.get('/', platformTenantController.list);
router.get('/:id', platformTenantController.getById);
router.get('/:id/users', platformTenantController.listUsers);

router.post('/:id/suspend', suspendValidator, validateRequest, platformTenantController.suspend);
router.post('/:id/activate', platformTenantController.activate);
router.post('/:id/extend-trial', trialDaysValidator, validateRequest, platformTenantController.extendTrial);
router.post('/:id/reduce-trial', trialDaysValidator, validateRequest, platformTenantController.reduceTrial);
router.post('/:id/reset-trial', resetTrialValidator, validateRequest, platformTenantController.resetTrial);
router.post('/:id/activate-subscription', platformTenantController.activateSubscription);
router.post('/:id/expire', platformTenantController.expireImmediately);

export default router;
