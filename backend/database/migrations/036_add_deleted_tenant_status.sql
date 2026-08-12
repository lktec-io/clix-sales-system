-- 036_add_deleted_tenant_status.sql
-- Platform hardening — adds a 'deleted' tenants.status value so Platform
-- Admin can offer a real "Delete Tenant" action.
--
-- Deliberately NOT a true SQL DELETE. tenant_id is referenced by dozens of
-- tables across every business vertical this platform supports, and two of
-- them (invoices, payments — 024_create_billing_tables.sql,
-- 035_create_payments_table.sql) use ON DELETE RESTRICT specifically so a
-- tenant with any billing history can never be silently destroyed. A hard
-- DELETE FROM tenants would therefore either fail outright the moment any
-- invoice/payment exists, or (for any table that DOES cascade) destroy
-- financial/audit records this platform is not allowed to lose. This
-- status value is the safe, architecture-consistent equivalent: it reuses
-- the exact enforcement resolveTenant() (backend/middlewares/
-- tenantContext.js) already has for 'suspended' — any status other than
-- 'active' blocks login/API access immediately — so no new access-control
-- code path is introduced, only a new value the existing check already
-- handles correctly by construction (`!== 'active'`).
--
-- 'deleted' is intentionally distinct from 'suspended': suspension is
-- expected-temporary/reversible (a billing hold, a support action);
-- deletion is the tenant's own explicit "close this account" outcome,
-- gated in the UI behind typing the exact company name to confirm.

ALTER TABLE tenants
  MODIFY COLUMN status ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active';
