import { Router } from 'express';
import * as platformAuditLogController from '../../controllers/platformAuditLog.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';

const router = Router();

router.use(authenticatePlatform);

router.get('/', platformAuditLogController.list);

export default router;
