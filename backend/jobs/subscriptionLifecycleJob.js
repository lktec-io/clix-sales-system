import cron from 'node-cron';
import { logger } from '../config/logger.js';
import * as subscriptionLifecycleService from '../services/subscriptionLifecycle.service.js';

// Off-peak, distinct from trialExpiryJob.js's 3am daily sweep and
// platformNotificationJob.js's 15-minute cadence — deliberately its own
// schedule so the three crons never contend or get confused for one
// another in logs. Only ever reads/writes tenant_subscriptions,
// subscription_events, and notifications — never `tenants`, never calls
// invalidateTenantCache(), never touches the other two job files.
const DAILY_AT_0330 = '30 3 * * *';

export function scheduleSubscriptionLifecycleSweep() {
  cron.schedule(DAILY_AT_0330, async () => {
    try {
      const appliedCount = await subscriptionLifecycleService.applyDueScheduledChanges();
      const transitions = await subscriptionLifecycleService.sweepLifecycleTransitions();
      logger.info('Subscription lifecycle sweep complete', { appliedCount, ...transitions });
    } catch (err) {
      logger.error('Subscription lifecycle sweep failed', { message: err.message });
    }
  });
}
