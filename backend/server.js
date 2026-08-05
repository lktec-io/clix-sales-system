import app from './app.js';
import { env } from './config/env.js';
import { testConnection } from './config/db.js';
import { logger } from './config/logger.js';
import { scheduleDailyBackup } from './jobs/backupJob.js';
import { scheduleTrialExpirySweep } from './jobs/trialExpiryJob.js';
import { schedulePlatformNotificationSweep } from './jobs/platformNotificationJob.js';
import { scheduleSubscriptionLifecycleSweep } from './jobs/subscriptionLifecycleJob.js';
import { ensureUploadDirs } from './middlewares/upload.js';

async function start() {
  try {
    await testConnection();
    logger.info('Database connection established');

    // Fresh servers (or any deploy that doesn't preserve empty directories)
    // won't have backend/uploads/<subfolder> yet — create them up front so
    // the first avatar/logo/product-image upload never hits ENOENT.
    await ensureUploadDirs();

    app.listen(env.port, () => {
      logger.info(`Clix Sales System API listening on port ${env.port} [${env.nodeEnv}]`);
    });

    scheduleDailyBackup();
    scheduleTrialExpirySweep();
    schedulePlatformNotificationSweep();
    scheduleSubscriptionLifecycleSweep();
  } catch (err) {
    logger.error('Failed to start server', { message: err.message });
    process.exit(1);
  }
}

start();
