-- 024_create_billing_tables.sql
-- Phase 4 — Premium SaaS Billing Engine. Introduces subscription plans,
-- per-tenant subscription state, an append-only lifecycle event log, and
-- invoices. This is a deliberately PARALLEL system to `tenants`.status /
-- `tenants`.subscription_status / trial_started_at / trial_ends_at — those
-- columns keep driving the existing Trial Engine (requireActiveTrial.js,
-- trialExpiryJob.js) completely unchanged. Nothing in this migration or the
-- code that reads/writes these new tables ever touches `tenants`.
--
-- No payment gateway integration happens in this phase (Phase 5). Every
-- subscription mutation here is a manual platform-admin override; the
-- schema is shaped so a future payment webhook can flip `invoices
-- .payment_status` and `tenant_subscriptions.status` through the exact same
-- functions without any redesign.

CREATE TABLE IF NOT EXISTS subscription_plans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  price_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_quarterly DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
  features JSON NULL,
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subscription_plans_slug (slug),
  KEY idx_subscription_plans_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Deterministic seed IDs (1/2/3) so this migration's own backfill below, and
-- any future migration, can reference "Starter" safely by literal id — same
-- idiom as 017_create_tenants_table.sql seeding tenant id=1. Prices are
-- illustrative and immediately editable via the Platform Admin UI (Step 2)
-- — pricing is data from the moment it exists, never a business-logic
-- constant.
INSERT IGNORE INTO subscription_plans
  (id, name, slug, description, price_monthly, price_quarterly, price_yearly, currency, is_recommended, is_active, sort_order)
VALUES
  (1, 'Starter', 'starter', 'For small shops just getting started.', 29000, 79000, 290000, 'TZS', FALSE, TRUE, 1),
  (2, 'Business', 'business', 'For growing businesses with multiple branches.', 59000, 159000, 590000, 'TZS', TRUE, TRUE, 2),
  (3, 'Enterprise', 'enterprise', 'For established operations needing full capacity.', 129000, 349000, 1290000, 'TZS', FALSE, TRUE, 3);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  status ENUM('trial','active','expired','suspended','cancelled','pending_payment','grace_period') NOT NULL DEFAULT 'trial',
  billing_cycle ENUM('monthly','quarterly','yearly') NOT NULL DEFAULT 'monthly',
  start_date DATETIME NULL,
  end_date DATETIME NULL,
  renewal_date DATETIME NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  trial_converted_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  cancellation_reason VARCHAR(255) NULL,
  grace_period_ends_at DATETIME NULL,
  -- Future scheduled plan change (Step 5) — set by scheduleplanChange(),
  -- applied (and cleared) by subscriptionLifecycleJob.js once
  -- scheduled_effective_date arrives. NULL on all three whenever no change
  -- is pending.
  scheduled_plan_id BIGINT UNSIGNED NULL,
  scheduled_billing_cycle ENUM('monthly','quarterly','yearly') NULL,
  scheduled_effective_date DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_subscriptions_tenant (tenant_id),
  KEY idx_tenant_subscriptions_status (status),
  KEY idx_tenant_subscriptions_grace_period_ends (grace_period_ends_at),
  KEY idx_tenant_subscriptions_scheduled_effective (scheduled_effective_date),
  KEY idx_tenant_subscriptions_renewal_date (renewal_date),
  CONSTRAINT fk_tenant_subscriptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id) ON DELETE RESTRICT,
  CONSTRAINT fk_tenant_subscriptions_scheduled_plan FOREIGN KEY (scheduled_plan_id) REFERENCES subscription_plans (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only lifecycle log — serves Step 3's "Upgrade History"/"Downgrade
-- History" as a filtered view (WHERE event_type IN (...)) of this one
-- table, rather than two separate tables that could drift apart.
CREATE TABLE IF NOT EXISTS subscription_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('created','upgraded','downgraded','renewed','cancelled','resumed','scheduled','schedule_applied','trial_converted') NOT NULL,
  from_plan_id BIGINT UNSIGNED NULL,
  to_plan_id BIGINT UNSIGNED NULL,
  from_cycle ENUM('monthly','quarterly','yearly') NULL,
  to_cycle ENUM('monthly','quarterly','yearly') NULL,
  effective_date DATETIME NOT NULL,
  reason VARCHAR(255) NULL,
  -- Nullable so a future cron/webhook-triggered event (Phase 5) has no
  -- human actor to record — same reasoning platform_audit_logs.
  -- platform_admin_id already established in 022_create_platform_admin_tables.sql.
  platform_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_subscription_events_tenant (tenant_id, created_at),
  KEY idx_subscription_events_subscription (subscription_id),
  KEY idx_subscription_events_type (event_type),
  CONSTRAINT fk_subscription_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
  CONSTRAINT fk_subscription_events_subscription FOREIGN KEY (subscription_id) REFERENCES tenant_subscriptions (id) ON DELETE CASCADE,
  CONSTRAINT fk_subscription_events_from_plan FOREIGN KEY (from_plan_id) REFERENCES subscription_plans (id) ON DELETE SET NULL,
  CONSTRAINT fk_subscription_events_to_plan FOREIGN KEY (to_plan_id) REFERENCES subscription_plans (id) ON DELETE SET NULL,
  CONSTRAINT fk_subscription_events_admin FOREIGN KEY (platform_admin_id) REFERENCES platform_admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Serves BOTH Step 6 "Billing History" and Step 7 "Invoice Engine" as one
-- table — deliberate consolidation, not an oversight. Every Step-6 field
-- (plan, cycle, amount, currency, status, created date, effective date,
-- reference number, invoice number) is a subset of what Step 7's printable
-- invoice needs, so a separate parallel ledger would only invite drift.
-- "Billing history must never be deleted" means never DELETE — an invoice
-- CAN still be updated (e.g. marked paid), hence updated_at.
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  event_id BIGINT UNSIGNED NULL,
  invoice_number VARCHAR(30) NOT NULL,
  reference_number VARCHAR(50) NULL,
  plan_id BIGINT UNSIGNED NULL,
  plan_name_snapshot VARCHAR(100) NOT NULL,
  billing_cycle ENUM('monthly','quarterly','yearly') NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  issue_date DATETIME NOT NULL,
  due_date DATETIME NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
  payment_status ENUM('pending','paid','failed','void','refunded') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoices_tenant_invoice_number (tenant_id, invoice_number),
  KEY idx_invoices_tenant (tenant_id, created_at),
  KEY idx_invoices_payment_status (payment_status),
  KEY idx_invoices_due_date (due_date),
  KEY idx_invoices_subscription (subscription_id),
  CONSTRAINT fk_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_invoices_subscription FOREIGN KEY (subscription_id) REFERENCES tenant_subscriptions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_invoices_event FOREIGN KEY (event_id) REFERENCES subscription_events (id) ON DELETE SET NULL,
  CONSTRAINT fk_invoices_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: every tenant that exists today gets a tenant_subscriptions row
-- on Starter, mirroring its current tenants.status/subscription_status/
-- trial_started_at/trial_ends_at — so no tenant is ever "billing-blank".
-- Going forward, brand-new tenants get their row lazily on first billing
-- read (tenantSubscription.repository.js's getOrCreateForTenant) rather
-- than via the registration flow, which this phase never touches.
INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, billing_cycle, start_date, end_date, renewal_date)
SELECT
  t.id,
  1,
  CASE t.subscription_status
    WHEN 'trial' THEN 'trial'
    WHEN 'expired' THEN 'expired'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'active'
  END,
  'monthly',
  COALESCE(t.trial_started_at, t.created_at),
  t.trial_ends_at,
  t.trial_ends_at
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM tenant_subscriptions ts WHERE ts.tenant_id = t.id);

INSERT INTO subscription_events (tenant_id, subscription_id, event_type, to_plan_id, to_cycle, effective_date, reason)
SELECT ts.tenant_id, ts.id, 'created', ts.plan_id, ts.billing_cycle, ts.created_at, 'Backfilled by 024_create_billing_tables.sql'
FROM tenant_subscriptions ts
WHERE NOT EXISTS (SELECT 1 FROM subscription_events se WHERE se.subscription_id = ts.id);
