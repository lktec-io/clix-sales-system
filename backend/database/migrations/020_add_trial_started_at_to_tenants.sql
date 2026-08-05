-- 020_add_trial_started_at_to_tenants.sql
-- Phase 2 — Self-Service Tenant Registration & Trial Provisioning.
-- trial_ends_at and subscription_status already exist (017); this adds the
-- companion "when did the trial begin" timestamp that registration stamps
-- alongside them. Nullable, no backfill: tenant 1 (seeded with
-- subscription_status='active') correctly gets NULL here — it was never on
-- a trial, so there's nothing true to backfill it with.

ALTER TABLE tenants
  ADD COLUMN trial_started_at DATETIME NULL AFTER subscription_status;
