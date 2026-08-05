import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { pool } from '../config/db.js';
import * as platformTenantRepository from '../repositories/platformTenant.repository.js';
import * as platformNotificationRepository from '../repositories/platformNotification.repository.js';

const EVERY_15_MINUTES = '*/15 * * * *';
const TRIAL_EXPIRING_WITHIN_DAYS = 3;

// Read-only scan of `tenants` + writes to `platform_notifications` only —
// never touches tenant.service.js's register() or trialExpiryJob.js. Each
// of the three checks below is one bounded, index-backed query with an
// embedded NOT EXISTS (see platformTenant.repository.js), so this stays
// cheap regardless of total tenant count; no per-tenant loop of existence
// checks anywhere in this file.
export function schedulePlatformNotificationSweep() {
  cron.schedule(EVERY_15_MINUTES, async () => {
    try {
      const [newTenants, expiringSoon, justExpired] = await Promise.all([
        platformTenantRepository.findRecentlyRegisteredUnnotified(),
        platformTenantRepository.findTrialsExpiringSoonUnnotified(TRIAL_EXPIRING_WITHIN_DAYS),
        platformTenantRepository.findExpiredUnnotified(),
      ]);

      for (const tenant of newTenants) {
        await platformNotificationRepository.fanOutToAllAdmins({
          type: 'info',
          category: 'tenant_registered',
          title: 'New tenant registered',
          message: `"${tenant.company_name}" just signed up.`,
          tenantId: tenant.id,
        });
      }

      for (const tenant of expiringSoon) {
        await platformNotificationRepository.fanOutToAllAdmins({
          type: 'warning',
          category: 'trial_expiring',
          title: 'Trial expiring soon',
          message: `"${tenant.company_name}"'s trial ends ${new Date(tenant.trial_ends_at).toLocaleDateString()}.`,
          tenantId: tenant.id,
        });
      }

      for (const tenant of justExpired) {
        await platformNotificationRepository.fanOutToAllAdmins({
          type: 'danger',
          category: 'trial_expired',
          title: 'Trial expired',
          message: `"${tenant.company_name}"'s trial has expired.`,
          tenantId: tenant.id,
        });
      }

      // "System warnings" (spec-scoped narrowly to what's actually
      // measurable today, see the Phase 3 plan) — the same DB health check
      // the platform dashboard uses, so a real outage produces one warning
      // per 15-minute window rather than being silently invisible.
      try {
        const connection = await pool.getConnection();
        connection.release();
      } catch (dbErr) {
        await platformNotificationRepository.fanOutToAllAdmins({
          type: 'danger',
          category: 'system',
          title: 'Database connectivity issue',
          message: dbErr.message,
        });
      }
    } catch (err) {
      logger.error('Platform notification sweep failed', { message: err.message });
    }
  });
}
