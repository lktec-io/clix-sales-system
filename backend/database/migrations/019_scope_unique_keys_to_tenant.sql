-- 019_scope_unique_keys_to_tenant.sql
-- Phase 1 of the multi-tenant SaaS foundation (continued from 017/018).
-- Converts every business-data UNIQUE KEY that was previously global
-- (across the whole install) into one scoped per tenant. For the single
-- tenant that exists today this changes nothing observable — a composite
-- key (tenant_id=1, email) accepts and rejects exactly the same values the
-- old plain (email) key did, since every row already has tenant_id = 1.
--
-- Done now rather than deferred to the self-registration phase because
-- document_sequences is a *live counter*, not just a uniqueness guard
-- (backend/repositories/sequence.repository.js does
-- INSERT ... ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)
-- keyed on this exact index) — a second tenant created before this ships
-- would silently share and race on one invoice/sale-number counter with
-- tenant 1, and every other key below would throw a raw duplicate-key error
-- the instant two tenants' independently-numbered records collided (e.g.
-- both tenants' first sale being "SALE-2026-00001"). Cheap now, with only
-- one tenant's rows to re-key; expensive later, with real per-tenant
-- collisions to resolve by hand.

ALTER TABLE users
  DROP KEY uq_users_email,
  DROP KEY uq_users_username,
  DROP KEY uq_users_phone,
  ADD UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  ADD UNIQUE KEY uq_users_tenant_username (tenant_id, username),
  ADD UNIQUE KEY uq_users_tenant_phone (tenant_id, phone);

ALTER TABLE branches
  DROP KEY uq_branches_code,
  ADD UNIQUE KEY uq_branches_tenant_code (tenant_id, code);

ALTER TABLE categories
  DROP KEY uq_categories_name,
  DROP KEY uq_categories_code,
  ADD UNIQUE KEY uq_categories_tenant_name (tenant_id, name),
  ADD UNIQUE KEY uq_categories_tenant_code (tenant_id, code);

ALTER TABLE brands
  DROP KEY uq_brands_name,
  DROP KEY uq_brands_code,
  ADD UNIQUE KEY uq_brands_tenant_name (tenant_id, name),
  ADD UNIQUE KEY uq_brands_tenant_code (tenant_id, code);

ALTER TABLE products
  DROP KEY uq_products_code,
  ADD UNIQUE KEY uq_products_tenant_code (tenant_id, code);

-- The live atomic counter — see header comment. Composite key order
-- (tenant_id, document_type, year) matches the column order the repository
-- already queries by, so the existing lookup stays a clean index seek.
ALTER TABLE document_sequences
  DROP KEY uq_document_sequences,
  ADD UNIQUE KEY uq_document_sequences_tenant (tenant_id, document_type, year);

ALTER TABLE customers
  DROP KEY uq_customers_code,
  DROP KEY uq_customers_phone,
  ADD UNIQUE KEY uq_customers_tenant_code (tenant_id, customer_code),
  ADD UNIQUE KEY uq_customers_tenant_phone (tenant_id, phone);

ALTER TABLE sales
  DROP KEY uq_sales_number,
  ADD UNIQUE KEY uq_sales_tenant_number (tenant_id, sale_number);

-- Same reasoning as sale_number above — a client-generated idempotency key
-- (see 014_add_sale_idempotency_key.sql) is astronomically unlikely to
-- collide by accident, but a global UNIQUE key would let a second tenant's
-- legitimate checkout be rejected by a first tenant's key it can't even see,
-- and there is no reason to accept that risk when scoping it is free.
ALTER TABLE sales
  DROP KEY uq_sales_idempotency_key,
  ADD UNIQUE KEY uq_sales_tenant_idempotency_key (tenant_id, idempotency_key);

ALTER TABLE returns
  DROP KEY uq_returns_number,
  ADD UNIQUE KEY uq_returns_tenant_number (tenant_id, return_number);

ALTER TABLE purchase_orders
  DROP KEY uq_purchase_orders_number,
  ADD UNIQUE KEY uq_purchase_orders_tenant_number (tenant_id, purchase_number);

ALTER TABLE stock_transfer_requests
  DROP KEY uq_stock_transfer_requests_number,
  ADD UNIQUE KEY uq_stock_transfer_requests_tenant_number (tenant_id, transfer_number);

ALTER TABLE expense_categories
  DROP KEY uq_expense_categories_name,
  ADD UNIQUE KEY uq_expense_categories_tenant_name (tenant_id, name);
