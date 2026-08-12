-- 039_create_sms_logs_table.sql
-- Beem SMS integration preparation. No SMS provider is wired up yet (no
-- Beem credentials exist in this environment) — this table and the code
-- that writes to it exist so that, once real credentials are entered on
-- the VPS and SMS_PROVIDER is set to a real provider name, every send
-- attempt (successful, failed, or skipped because SMS isn't configured or
-- a tenant hit its rate limit) is already logged with zero further schema
-- change. See backend/services/smsProviders/ for the provider-agnostic
-- architecture this feeds.

CREATE TABLE IF NOT EXISTS sms_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  repair_id BIGINT UNSIGNED NULL,
  category VARCHAR(50) NOT NULL,
  recipient_phone VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  status ENUM('sent','failed','skipped_not_configured','skipped_rate_limited') NOT NULL,
  provider_response TEXT NULL,
  sent_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sms_logs_tenant (tenant_id, created_at),
  KEY idx_sms_logs_repair (repair_id),
  CONSTRAINT fk_sms_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sms_logs_repair FOREIGN KEY (repair_id) REFERENCES repairs (id) ON DELETE SET NULL,
  CONSTRAINT fk_sms_logs_sent_by FOREIGN KEY (sent_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
