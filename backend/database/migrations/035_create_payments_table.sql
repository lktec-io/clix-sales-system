-- 035_create_payments_table.sql
-- Phase 6 — SaaS Payment Architecture. Adds the one piece
-- 024_create_billing_tables.sql's own comments explicitly anticipated but
-- deliberately left out: a provider-agnostic ledger of actual payment
-- transaction attempts. `invoices` already records WHAT is owed and
-- whether it's paid; `payments` records HOW/whether an actual attempt to
-- pay it happened — a tenant can retry a failed payment against the same
-- invoice, so this is a one-to-many child of `invoices`, not a duplicate
-- of it. Nothing here replaces or competes with tenant_subscriptions,
-- subscription_events, or invoices — each keeps its existing single
-- purpose.
--
-- No payment gateway is wired up yet (no provider credentials exist in
-- this environment). This table and the code that reads/writes it are
-- shaped so a real provider's webhook can call the exact same
-- markPaymentSucceeded()/markPaymentFailed() functions a manual/stub
-- provider calls today, with zero schema change.

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NULL,
  plan_id BIGINT UNSIGNED NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
  provider VARCHAR(50) NOT NULL,
  provider_transaction_id VARCHAR(150) NULL,
  internal_reference VARCHAR(50) NOT NULL,
  status ENUM('pending','processing','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50) NULL,
  paid_at DATETIME NULL,
  failure_reason VARCHAR(255) NULL,
  -- Raw provider payload (webhook body, checkout response) for support/
  -- reconciliation — never used to derive trust; every field the server
  -- actually acts on (amount, status, tenant/plan match) is validated
  -- against internal_reference/payments.amount, never read out of this
  -- blob for a business decision.
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- internal_reference is the idempotency anchor the server itself
  -- generates at checkout-initiation time — a duplicate/replayed webhook
  -- for the same reference is a no-op update, never a second row.
  UNIQUE KEY uq_payments_internal_reference (internal_reference),
  -- provider_transaction_id is nullable (not known until the provider
  -- responds) but must be unique once set, so the exact same upstream
  -- transaction can never be recorded as two different payments.
  UNIQUE KEY uq_payments_provider_transaction (provider, provider_transaction_id),
  KEY idx_payments_tenant (tenant_id, created_at),
  KEY idx_payments_subscription (subscription_id),
  KEY idx_payments_invoice (invoice_id),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_subscription FOREIGN KEY (subscription_id) REFERENCES tenant_subscriptions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
