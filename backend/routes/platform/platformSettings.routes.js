import { Router } from 'express';
import * as platformSettingsController from '../../controllers/platformSettings.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { updatePlatformSettingsValidator } from '../../validators/platformSettings.validator.js';

const router = Router();

router.use(authenticatePlatform);

router.get('/', platformSettingsController.getSettings);
router.put('/', updatePlatformSettingsValidator, validateRequest, platformSettingsController.updateSettings);

export default router;
