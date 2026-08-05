-- 023_add_tenant_management_indexes.sql
-- Phase 3 — Clix SaaS Owner Portal (Platform Administration).
-- Purely additive indexes on the existing tenants table — no column
-- change, no data change, zero risk to any existing query. Backs the
-- platform dashboard's aggregate KPI queries (COUNT ... GROUP BY status /
-- subscription_status), the tenant management list's status/subscription
-- filters, and platformNotificationJob.js's trial-expiry scan — all
-- explicitly required to stay index-backed as the tenant count grows into
-- the thousands.

ALTER TABLE tenants
  ADD KEY idx_tenants_status (status),
  ADD KEY idx_tenants_subscription_status (subscription_status),
  ADD KEY idx_tenants_created_at (created_at),
  ADD KEY idx_tenants_subscription_trial_ends (subscription_status, trial_ends_at);
