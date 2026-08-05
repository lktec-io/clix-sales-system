import cron from 'node-cron';
import { logger } from '../config/logger.js';
import * as tenantRepository from '../repositories/tenant.repository.js';
import { invalidateTenantCache } from '../middlewares/tenantContext.js';

const DAILY_AT_3AM = '0 3 * * *';

// The live per-request check (requireActiveTrial.js) already blocks writes
// the instant trial_ends_at passes — this sweep just keeps the stored
// subscription_status column truthful (for the Trial Card label and any
// future admin/Phase-3 tooling) instead of letting it silently drift from
// what's already being enforced. A failure here is logged, never thrown —
// same convention as backupJob.js.
export function scheduleTrialExpirySweep() {
  cron.schedule(DAILY_AT_3AM, async () => {
    try {
      const count = await tenantRepository.expireOverdueTrials();
      if (count) {
        invalidateTenantCache(); // clears the whole cache — simplest, correct for a rare daily sweep
        logger.info(`Trial expiry sweep: ${count} tenant(s) marked expired`);
      }
    } catch (err) {
      logger.error('Trial expiry sweep failed', { message: err.message });
    }
  });
}
