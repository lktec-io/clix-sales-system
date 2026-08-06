import { Router } from 'express';
import * as tenantModuleController from '../controllers/tenantModule.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = Router();
router.use(authenticate);

router.get('/me', tenantModuleController.getMine);

export default router;
