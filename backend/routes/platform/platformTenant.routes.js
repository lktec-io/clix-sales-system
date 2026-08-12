import { Router } from 'express';
import * as platformTenantController from '../../controllers/platformTenant.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import {
  trialDaysValidator, resetTrialValidator, suspendValidator, deleteTenantValidator, hardDeleteTenantValidator,
  setBusinessTemplateValidator, setModuleOverrideValidator,
} from '../../validators/platformTenant.validator.js';

const router = Router();

router.use(authenticatePlatform);

router.get('/', platformTenantController.list);
router.get('/:id', platformTenantController.getById);
router.get('/:id/users', platformTenantController.listUsers);

router.post('/:id/suspend', suspendValidator, validateRequest, platformTenantController.suspend);
router.post('/:id/activate', platformTenantController.activate);
router.post('/:id/delete', deleteTenantValidator, validateRequest, platformTenantController.remove);
router.get('/:id/hard-delete-preview', platformTenantController.hardDeletePreview);
router.post('/:id/hard-delete', hardDeleteTenantValidator, validateRequest, platformTenantController.hardDelete);
router.post('/:id/restore', platformTenantController.restore);
router.post('/:id/extend-trial', trialDaysValidator, validateRequest, platformTenantController.extendTrial);
router.post('/:id/reduce-trial', trialDaysValidator, validateRequest, platformTenantController.reduceTrial);
router.post('/:id/reset-trial', resetTrialValidator, validateRequest, platformTenantController.resetTrial);
router.post('/:id/activate-subscription', platformTenantController.activateSubscription);
router.post('/:id/expire', platformTenantController.expireImmediately);

router.post('/:id/business-template', setBusinessTemplateValidator, validateRequest, platformTenantController.setBusinessTemplate);
router.get('/:id/module-overrides', platformTenantController.getModuleOverrides);
router.post('/:id/module-overrides', setModuleOverrideValidator, validateRequest, platformTenantController.setModuleOverride);

export default router;
