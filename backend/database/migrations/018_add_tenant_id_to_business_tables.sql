-- 018_add_tenant_id_to_business_tables.sql
-- Phase 1 of the multi-tenant SaaS foundation (continued from 017). Adds a
-- tenant_id column, FK, and index to every table that represents
-- tenant-owned business data. `NOT NULL DEFAULT 1` is intentional and does
-- all the migration work by itself: MySQL 8 backfills every existing row to
-- the default tenant (017) instantly (metadata-only DDL, no table rewrite,
-- no manual UPDATE needed), and every INSERT that doesn't yet pass
-- tenant_id explicitly still lands safely on tenant 1 until the
-- corresponding repository is updated to stamp it (tracked separately —
-- this migration is purely additive and changes no query's behavior today).
--
-- Tables intentionally left OUT of this migration:
--   - Global/shared catalogs with no per-tenant dimension: roles,
--     permissions, role_permissions, system_backups, email_logs.
--   - Child/line-item tables that are never queried independently of an
--     already tenant-scoped parent (sale_items, purchase_items,
--     return_items, stock_transfer_items, supplier_payments,
--     product_images, qr_codes, user_branches, sessions, refresh_tokens,
--     password_resets, notifications).
-- activity_logs and audit_logs get tenant_id directly below (not left as
-- "inherits from parent") because activity_logs.findRecent() is queried
-- standalone for the dashboard's recent-activity widget, and audit_logs is
-- a forensic/compliance trail that will be searched standalone once wired
-- up — both are free to add now, before any cross-tenant query exists.

-- Master/reference data
ALTER TABLE branches
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_branches_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_branches_tenant (tenant_id);

ALTER TABLE users
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_users_tenant (tenant_id);

ALTER TABLE company_settings
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_company_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  -- One company profile per tenant, enforced going forward — matches the
  -- app's existing single-row-per-install assumption (company.repository.js
  -- get() already does ORDER BY id LIMIT 1) for the one tenant that exists
  -- today, while making a second tenant's profile impossible to collide
  -- with the first's.
  ADD UNIQUE KEY uq_company_settings_tenant (tenant_id);

ALTER TABLE system_settings
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_system_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  DROP KEY uq_system_settings_key,
  ADD UNIQUE KEY uq_system_settings_tenant_key (tenant_id, setting_key);

ALTER TABLE categories
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_categories_tenant (tenant_id);

ALTER TABLE brands
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_brands_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_brands_tenant (tenant_id);

ALTER TABLE document_sequences
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_document_sequences_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_document_sequences_tenant (tenant_id);

ALTER TABLE products
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_products_tenant (tenant_id);

ALTER TABLE suppliers
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_suppliers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_suppliers_tenant (tenant_id);

ALTER TABLE customers
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_customers_tenant (tenant_id);

ALTER TABLE expense_categories
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_expense_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_expense_categories_tenant (tenant_id);

-- Transactional data (most already carry branch_id — tenant_id is
-- deliberately denormalized alongside it rather than resolved via a JOIN to
-- branches.tenant_id: uniform `tenant_id = ?` filtering everywhere, and
-- defense-in-depth if a JOIN is ever missed — see backend/utils/tenantScope.js)
ALTER TABLE sales
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_sales_tenant (tenant_id);

ALTER TABLE purchase_orders
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_purchase_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_purchase_orders_tenant (tenant_id);

ALTER TABLE expenses
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_expenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_expenses_tenant (tenant_id);

ALTER TABLE inventory
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_inventory_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_inventory_tenant (tenant_id);

ALTER TABLE inventory_movements
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_inventory_movements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_inventory_movements_tenant (tenant_id);

ALTER TABLE inventory_adjustments
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_inventory_adjustments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_inventory_adjustments_tenant (tenant_id);

ALTER TABLE returns
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_returns_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_returns_tenant (tenant_id);

ALTER TABLE stock_transfer_requests
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_stock_transfer_requests_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_stock_transfer_requests_tenant (tenant_id);

-- Dashboard/audit logs — queried standalone (see header comment)
ALTER TABLE activity_logs
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_activity_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_activity_logs_tenant (tenant_id);

ALTER TABLE audit_logs
  ADD COLUMN tenant_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  ADD KEY idx_audit_logs_tenant (tenant_id);
