import { Router } from 'express';
import * as subscriptionPlanController from '../../controllers/subscriptionPlan.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { createPlanValidator, updatePlanValidator, reorderValidator } from '../../validators/subscriptionPlan.validator.js';

const router = Router();
router.use(authenticatePlatform);

router.get('/', subscriptionPlanController.list);
router.post('/reorder', reorderValidator, validateRequest, subscriptionPlanController.reorder);
router.get('/:id', subscriptionPlanController.getById);
router.post('/', createPlanValidator, validateRequest, subscriptionPlanController.create);
router.put('/:id', updatePlanValidator, validateRequest, subscriptionPlanController.update);
router.post('/:id/activate', subscriptionPlanController.activate);
router.post('/:id/deactivate', subscriptionPlanController.deactivate);
router.post('/:id/mark-recommended', subscriptionPlanController.markRecommended);

export default router;
