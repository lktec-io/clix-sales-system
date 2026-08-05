import { Router } from 'express';
import * as platformAuthController from '../../controllers/platformAuth.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';
import { platformAuthLimiter } from '../../middlewares/rateLimiter.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { platformLoginValidator } from '../../validators/platformAuth.validator.js';

const router = Router();

router.post('/login', platformAuthLimiter, platformLoginValidator, validateRequest, platformAuthController.login);
router.post('/refresh', platformAuthController.refresh);
router.post('/logout', platformAuthController.logout);
router.get('/me', authenticatePlatform, platformAuthController.me);

export default router;
