-- 046_recalculate_trial_to_7_days.sql
-- The official trial period changes from 14 to 7 days (tenant.service.js's
-- TRIAL_DAYS constant, already updated in application code — this
-- migration is the one-time data catch-up for tenants that registered
-- under the old 14-day rule). Every NEW registration after this ships
-- already gets a correct 7-day trial via TRIAL_DAYS; this only touches
-- tenants CURRENTLY mid-trial.
--
-- Deliberately recomputes from each tenant's own, already-recorded
-- trial_started_at — never resets to "NOW() + 7 days", which would hand
-- every existing trial tenant a fresh full week regardless of how much of
-- their original trial they'd already used. A tenant 3 days into their
-- trial ends up with ~4 days left; a tenant already 10 days in ends up
-- immediately over their new (earlier) cutoff.
--
-- Two tables both need the same recompute: `tenants.trial_ends_at` (the
-- legacy column requireActiveTrial.js only falls back to when a tenant has
-- no tenant_subscriptions row — should not happen post-024, but kept in
-- sync for the Trial Card / any other reader of this column) and
-- `tenant_subscriptions.end_date`/`renewal_date` (the column that
-- middleware actually enforces against for every tenant, since every
-- tenant already has a row here per 024's own backfill).
--
-- Deliberately does NOT flip status to 'expired' directly here — that
-- would skip the grace period every other subscription transition already
-- gets (subscriptionLifecycle.service.js#sweepLifecycleTransitions(),
-- run daily by subscriptionLifecycleJob.js). Recomputing the date is
-- enough: any trial whose new end_date has already passed is picked up by
-- that existing, already-correct sweep on its next run (grace period
-- first, then expired) exactly like any other subscription lapsing —
-- no special-cased shortcut invented for this migration.
UPDATE tenants
SET trial_ends_at = DATE_ADD(trial_started_at, INTERVAL 7 DAY)
WHERE subscription_status = 'trial' AND trial_started_at IS NOT NULL;

UPDATE tenant_subscriptions ts
JOIN tenants t ON t.id = ts.tenant_id
SET ts.end_date = DATE_ADD(t.trial_started_at, INTERVAL 7 DAY),
    ts.renewal_date = DATE_ADD(t.trial_started_at, INTERVAL 7 DAY)
WHERE ts.status = 'trial' AND t.trial_started_at IS NOT NULL;
