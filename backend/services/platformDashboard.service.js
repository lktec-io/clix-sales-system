import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import * as platformTenantRepository from '../repositories/platformTenant.repository.js';
import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';
import * as tenantSubscriptionRepository from '../repositories/tenantSubscription.repository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

// Same "degrade one widget, never 500 the whole dashboard" convention the
// tenant dashboard's dashboard.service.js already established.
async function safely(label, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    logger.error(`Platform dashboard query failed: ${label}`, { message: err.message, stack: err.stack });
    return fallback;
  }
}

export async function getKpis() {
  const [counts, registrations] = await Promise.all([
    safely('kpi-counts', () => platformTenantRepository.getKpiCounts(), { total: 0, active: 0, trial: 0, expired: 0, suspended: 0 }),
    safely('registration-counts', () => platformTenantRepository.getRegistrationCounts(), { today: 0, thisMonth: 0, last30Days: 0 }),
  ]);

  return {
    totalTenants: counts.total,
    activeTenants: counts.active,
    trialTenants: counts.trial,
    expiredTenants: counts.expired,
    suspendedTenants: counts.suspended,
    newRegistrations: registrations.last30Days,
    todaysRegistrations: registrations.today,
    thisMonthRegistrations: registrations.thisMonth,
  };
}

// Nothing here is simulated — matches the tenant dashboard's own
// getSystemStatus() convention exactly (see dashboard.repository.js).
export async function getSystemStatus() {
  const dbConnected = await safely('db-health', async () => {
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT 1');
      return true;
    } finally {
      connection.release();
    }
  }, false);

  return {
    databaseConnected: dbConnected,
    apiStatus: 'up', // this response existing at all is the proof
    health: dbConnected ? 'healthy' : 'degraded',
  };
}

// Real, honest numbers — no fabricated aggregate. If Cloudinary is
// configured, local disk usage is not the real storage picture, so that's
// stated plainly rather than presenting a misleading number.
export async function getStorageUsage() {
  const cloudinaryConfigured = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

  const localBytes = await safely('local-storage-scan', async () => {
    async function dirSize(dir) {
      let total = 0;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return 0; // directory doesn't exist yet — zero usage, not an error
      }
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) total += await dirSize(entryPath);
        else {
          const stat = await fs.stat(entryPath);
          total += stat.size;
        }
      }
      return total;
    }
    return dirSize(UPLOADS_ROOT);
  }, 0);

  return {
    localBytes,
    localMb: Math.round((localBytes / (1024 * 1024)) * 100) / 100,
    cloudinaryConfigured,
  };
}

export async function getRecentActivity(limit = 20) {
  return safely('recent-activity', () => platformAuditLogRepository.findRecent(limit), []);
}

// Phase 4 — Premium SaaS Billing Engine. Additive: getKpis()/
// getSystemStatus()/getStorageUsage()/getRecentActivity() above are
// unchanged. "Monthly Signups" is deliberately NOT recomputed here — it's
// already thisMonthRegistrations in getKpis()'s response, so the billing
// dashboard just reuses that existing call instead of a duplicate query
// (Step 13's "avoid duplicate calculations").
export async function getBillingKpis() {
  const [statusCounts, expiringSoon, trialConversions, mostPopularPlan, monthlyRevenue] = await Promise.all([
    safely('subscription-status-counts', () => tenantSubscriptionRepository.getStatusCounts(), {
      trial: 0, active: 0, expired: 0, suspended: 0, cancelled: 0, pending_payment: 0, grace_period: 0,
    }),
    safely('expiring-soon-count', () => tenantSubscriptionRepository.getExpiringSoonCount(7), 0),
    safely('trial-conversion-count', () => tenantSubscriptionRepository.getTrialConversionCount(30), 0),
    safely('most-popular-plan', () => tenantSubscriptionRepository.getMostPopularPlan(), null),
    safely('monthly-revenue-projected', () => tenantSubscriptionRepository.getMonthlyRevenueProjected(), 0),
  ]);

  return {
    activeSubscriptions: statusCounts.active,
    expiringSoon,
    expired: statusCounts.expired,
    trialConversions,
    mostPopularPlan,
    monthlyRevenueProjected: monthlyRevenue,
    annualRevenueProjected: monthlyRevenue * 12,
  };
}
