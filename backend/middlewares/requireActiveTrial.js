import { ApiError } from '../utils/apiError.js';

// Blocks writes for a tenant whose trial has lapsed (or was explicitly
// marked expired by the daily sweep, backend/jobs/trialExpiryJob.js) —
// never gates login/dashboard/reports/profile/settings, which read-only
// routes never apply this middleware to in the first place. Computed live
// off trial_ends_at (not solely the stored subscription_status) so
// blocking takes effect the instant the 14 days elapse, not whenever the
// cron next runs.
//
// 402 Payment Required is otherwise unused anywhere in this backend — a
// clean, unambiguous signal the frontend can special-case later (Phase 3)
// without colliding with any existing 4xx meaning.
export function requireActiveTrial(req, res, next) {
  const tenant = req.tenant; // populated by authenticate.js

  const trialExpired = tenant.subscription_status === 'trial'
    && tenant.trial_ends_at
    && new Date(tenant.trial_ends_at) <= new Date();

  if (trialExpired || tenant.subscription_status === 'expired') {
    throw new ApiError(402, 'Your trial has expired. Upgrade your subscription to continue.');
  }

  return next();
}
