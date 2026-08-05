import { Router } from 'express';
import * as platformDashboardController from '../../controllers/platformDashboard.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';

const router = Router();

router.use(authenticatePlatform);

router.get('/kpis', platformDashboardController.getKpis);
router.get('/system-status', platformDashboardController.getSystemStatus);
router.get('/storage', platformDashboardController.getStorageUsage);
router.get('/recent-activity', platformDashboardController.getRecentActivity);
router.get('/billing-kpis', platformDashboardController.getBillingKpis);

export default router;
