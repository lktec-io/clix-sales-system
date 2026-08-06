import { Router } from 'express';
import * as businessTemplateController from '../../controllers/businessTemplate.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import {
  createTemplateValidator, updateTemplateValidator, duplicateTemplateValidator,
  setModulesValidator, setDefaultSettingValidator,
} from '../../validators/businessTemplate.validator.js';

const router = Router();
router.use(authenticatePlatform);

router.get('/', businessTemplateController.list);
router.get('/:id', businessTemplateController.getDetail);
router.post('/', createTemplateValidator, validateRequest, businessTemplateController.create);
router.put('/:id', updateTemplateValidator, validateRequest, businessTemplateController.update);
router.post('/:id/duplicate', duplicateTemplateValidator, validateRequest, businessTemplateController.duplicate);
router.post('/:id/activate', businessTemplateController.activate);
router.post('/:id/deactivate', businessTemplateController.deactivate);
router.post('/:id/archive', businessTemplateController.archive);
router.put('/:id/modules', setModulesValidator, validateRequest, businessTemplateController.setModules);
router.put('/:id/settings', setDefaultSettingValidator, validateRequest, businessTemplateController.setDefaultSetting);

export default router;
