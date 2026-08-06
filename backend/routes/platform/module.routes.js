import { Router } from 'express';
import * as moduleController from '../../controllers/module.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { createModuleValidator, updateModuleValidator } from '../../validators/module.validator.js';

const router = Router();
router.use(authenticatePlatform);

router.get('/', moduleController.list);
router.get('/:id', moduleController.getById);
router.post('/', createModuleValidator, validateRequest, moduleController.create);
router.put('/:id', updateModuleValidator, validateRequest, moduleController.update);
router.post('/:id/activate', moduleController.activate);
router.post('/:id/deactivate', moduleController.deactivate);

export default router;
