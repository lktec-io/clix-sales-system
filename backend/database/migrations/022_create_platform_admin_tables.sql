-- 022_create_platform_admin_tables.sql
-- Phase 3 — Clix SaaS Owner Portal (Platform Administration).
-- Five new, fully global tables (no tenant_id anywhere) backing a
-- completely separate authentication/authorization system for Clix
-- Digital Works' own platform administrators — never a tenant user, never
-- reachable with a tenant JWT (see backend/middlewares/authenticatePlatform.js
-- and backend/utils/platformTokenUtils.js, which sign/verify with a
-- distinct secret from the tenant JWT_ACCESS_SECRET/JWT_REFRESH_SECRET).

CREATE TABLE IF NOT EXISTS platform_admins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  -- Mirrors users.failed_login_attempts/locked_until (002_create_branches_users.sql)
  -- exactly — same brute-force lockout defense, reusing the existing
  -- MAX_LOGIN_ATTEMPTS/LOCKOUT_MINUTES constants from utils/constants.js.
  failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_platform_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One table, not the tenant system's sessions+refresh_tokens pair — no
-- "manage my devices" UI is requested for platform admins, and this alone
-- still supports login / rotate-on-refresh / logout / revoke-all.
CREATE TABLE IF NOT EXISTS platform_refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform_admin_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_platform_refresh_tokens_admin (platform_admin_id),
  CONSTRAINT fk_platform_refresh_tokens_admin FOREIGN KEY (platform_admin_id) REFERENCES platform_admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Deliberately separate from the tenant-scoped activity_logs table — two
-- fully independent audit trails, never joined, never sharing a row.
-- platform_admin_id is nullable to leave room for a future system/webhook-
-- triggered entry (Phase 4) that has no human actor.
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform_admin_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  tenant_id BIGINT UNSIGNED NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_platform_audit_logs_admin (platform_admin_id),
  KEY idx_platform_audit_logs_tenant (tenant_id),
  KEY idx_platform_audit_logs_created (created_at),
  CONSTRAINT fk_platform_audit_logs_admin FOREIGN KEY (platform_admin_id) REFERENCES platform_admins (id) ON DELETE SET NULL,
  CONSTRAINT fk_platform_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform_admin_id BIGINT UNSIGNED NOT NULL,
  type ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
  category VARCHAR(50) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NULL,
  tenant_id BIGINT UNSIGNED NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_platform_notifications_admin (platform_admin_id, read_at),
  KEY idx_platform_notifications_tenant_category (tenant_id, category),
  CONSTRAINT fk_platform_notifications_admin FOREIGN KEY (platform_admin_id) REFERENCES platform_admins (id) ON DELETE CASCADE,
  CONSTRAINT fk_platform_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Same key/value shape as the tenant system_settings table, minus
-- tenant_id — this is genuinely global, platform-wide configuration.
CREATE TABLE IF NOT EXISTS platform_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL,
  setting_value VARCHAR(500) NULL,
  data_type ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_platform_settings_key (setting_key),
  CONSTRAINT fk_platform_settings_updated_by FOREIGN KEY (updated_by) REFERENCES platform_admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
