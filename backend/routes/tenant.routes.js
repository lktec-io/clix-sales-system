import { Router } from 'express';
import * as tenantController from '../controllers/tenant.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { registrationLimiter } from '../middlewares/rateLimiter.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { registerValidator } from '../validators/tenant.validator.js';

const router = Router();

// Public — the signup form loads this before any tenant/session exists.
router.get('/templates', tenantController.listTemplates);
router.post('/register', registrationLimiter, registerValidator, validateRequest, tenantController.register);
router.get('/me', authenticate, tenantController.getMyTenant);

export default router;
