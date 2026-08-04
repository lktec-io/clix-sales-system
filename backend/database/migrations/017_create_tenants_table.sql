-- 017_create_tenants_table.sql
-- Phase 1 of the multi-tenant SaaS foundation. Introduces the `tenants`
-- table as the new top-level entity every business record will belong to
-- (see 018/019). This migration alone is a no-op for the running app —
-- nothing reads this table yet, so it's safe to apply independently of any
-- code deploy. subscription_status/trial_ends_at are reserved for a future
-- self-service signup phase (explicitly out of scope here) — no code path
-- reads or writes them yet; kept now so that phase needs no further schema
-- change.

CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL,
  company_code VARCHAR(50) NOT NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  subscription_status ENUM('active','trial','expired','cancelled') NOT NULL DEFAULT 'active',
  trial_ends_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenants_company_code (company_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The single tenant every existing installation's data will be backfilled
-- onto in 018/019 (via `DEFAULT 1` on the new tenant_id columns) — explicit
-- id=1, not left to AUTO_INCREMENT, so every later ALTER TABLE's
-- `DEFAULT 1` is guaranteed correct regardless of insert order.
INSERT IGNORE INTO tenants (id, company_name, company_code, status, subscription_status)
VALUES (1, 'Default Tenant', 'default', 'active', 'active');

-- Best-effort continuity: if a company profile was already filled in
-- (backend/database/migrations/003_create_settings_sessions.sql's
-- company_settings), carry its real name onto the default tenant instead of
-- leaving the generic placeholder — purely cosmetic, safe to skip if no
-- company_settings row exists yet.
UPDATE tenants t
JOIN company_settings cs ON cs.id = (SELECT MIN(id) FROM company_settings)
SET t.company_name = cs.company_name
WHERE t.id = 1 AND cs.company_name IS NOT NULL AND cs.company_name <> '';
