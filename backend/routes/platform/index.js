import { Router } from 'express';
import platformAuthRoutes from './platformAuth.routes.js';
import platformDashboardRoutes from './platformDashboard.routes.js';
import platformTenantRoutes from './platformTenant.routes.js';
import platformAuditLogRoutes from './platformAuditLog.routes.js';
import platformNotificationRoutes from './platformNotification.routes.js';
import platformSettingsRoutes from './platformSettings.routes.js';
import platformPlanRoutes from './platformPlan.routes.js';
import platformSubscriptionRoutes from './platformSubscription.routes.js';

// Mounted at /api/v1/platform by app.js — never touches backend/routes/index.js
// (the tenant router tree), so the tenant API surface has zero diff from
// this phase.
const router = Router();

router.use('/auth', platformAuthRoutes);
router.use('/dashboard', platformDashboardRoutes);
router.use('/tenants', platformTenantRoutes);
router.use('/audit-logs', platformAuditLogRoutes);
router.use('/notifications', platformNotificationRoutes);
router.use('/settings', platformSettingsRoutes);
router.use('/plans', platformPlanRoutes);
router.use('/subscriptions', platformSubscriptionRoutes);

export default router;
