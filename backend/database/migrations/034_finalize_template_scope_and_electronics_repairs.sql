-- 034_finalize_template_scope_and_electronics_repairs.sql
--
-- Two things in one migration, both purely additive/reversible — no old
-- migration touched, no destructive DROP anywhere:
--
-- 1. Finalizes the platform's business-template scope down to exactly six:
--    Retail Store, Pharmacy, Restaurant, Microfinance, Cosmetics & Beauty
--    (renamed from "Cosmetics Shop"), Electronics / Phone & Computer
--    Service (renamed from "Electronics Shop"). The six templates being
--    dropped (General Business, Wholesale Store, Hardware Store, Clothing
--    Store, School, SACCOS) have zero application code built on them
--    (confirmed by full-repo audit) — they are archived via the existing
--    status mechanism (businessTemplateService already has real
--    Activate/Deactivate/Archive actions built for exactly this), not
--    deleted, so any FK integrity or historical reference is preserved.
--    Archived = hidden from new-tenant signup, but a tenant already
--    assigned to one keeps working unchanged (none exist in this
--    repo/sandbox, but the mechanism is production-safe regardless).
--
-- 2. Builds the Electronics/Phone & Computer Service system's one
--    genuinely new concept: Repair Management. Sales/Products/Inventory/
--    Purchases/Customers/Suppliers/Expenses/Reports are all reused
--    unmodified from the existing retail modules (a phone is a product
--    like any other — this is not Pharmacy's batch-grain problem or
--    Restaurant's completely different workflow), so no parallel
--    sales/inventory schema is created here, exactly per the explicit
--    instruction to reuse rather than duplicate.

-- ============================================================
-- Part 1 — finalize template scope
-- ============================================================

-- Archive the six templates with no application code, scoped by slug (not
-- id) so this is correct even if a row's id ever drifted from the
-- deterministic seed values — same defensive pattern as 032's reassertion.
UPDATE business_templates SET status = 'archived'
WHERE slug IN ('general-business', 'wholesale-store', 'hardware-store', 'clothing-store', 'school', 'saccos');

-- Rename the two templates being repurposed into their final-six identity.
-- Slugs are left unchanged (nothing keys off them except Register.jsx's
-- purely-cosmetic icon lookup, which degrades gracefully to a fallback
-- icon for any slug it doesn't recognize) — only the tenant-facing name
-- and description change.
UPDATE business_templates SET
  name = 'Electronics / Phone & Computer Service',
  description = 'Phone and computer sales, accessories, and a full repair-shop workflow — device intake, diagnosis, parts, and collection.'
WHERE slug = 'electronics-shop';

UPDATE business_templates SET
  name = 'Cosmetics & Beauty',
  description = 'Perfumes, body care, hair products, and beauty accessories retail.'
WHERE slug = 'cosmetics-shop';

-- Electronics currently has every retail module enabled (026's bulk
-- 1-9 CROSS JOIN) — drop Returns/Transfers, which aren't part of the
-- requested lean navigation (Sales, Products, Inventory, Repairs,
-- Customers, Suppliers, Expenses, Reports). Purchases stays: Suppliers is
-- explicitly requested, and a supplier relationship is meaningless without
-- a way to receive stock from them.
UPDATE template_modules SET is_enabled = FALSE
WHERE business_template_id = (SELECT id FROM business_templates WHERE slug = 'electronics-shop')
  AND module_id IN (8, 12); -- returns, transfers

-- Cosmetics & Beauty's module set is left exactly as-is (already the lean
-- retail set requested — Sales/Products/Inventory/Purchases/Customers/
-- Suppliers/Expenses/Reports) — only its display name changed above.

-- ============================================================
-- Part 2 — Repair Management schema
-- ============================================================

-- One row per repair job. balance is deliberately NOT a stored column —
-- computed at read time from repair_total/amount_paid (repository layer),
-- the same "never let a derived number drift" principle current_stock
-- uses in medicine.repository.js. Structured device-condition/accessories
-- checklists are stored as JSON rather than ~10 separate columns each —
-- a flexible checklist, not a rigid relational shape, and still fully
-- queryable via JSON functions if a future report ever needs it.
CREATE TABLE IF NOT EXISTS repairs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  repair_number VARCHAR(30) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  device_type ENUM('smartphone','tablet','laptop','desktop','printer','other') NOT NULL,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100) NULL,
  imei_1 VARCHAR(20) NULL,
  imei_2 VARCHAR(20) NULL,
  device_color VARCHAR(50) NULL,
  reported_problem VARCHAR(1000) NOT NULL,
  diagnosis VARCHAR(1000) NULL,
  repair_notes VARCHAR(1000) NULL,
  device_condition JSON NULL,
  accessories_received JSON NULL,
  technician_id BIGINT UNSIGNED NULL,
  status ENUM(
    'received','diagnosis','waiting_approval','approved','in_repair',
    'ready_for_collection','completed','cancelled','rejected','unrepairable'
  ) NOT NULL DEFAULT 'received',
  parts_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  labor_charge DECIMAL(15,2) NOT NULL DEFAULT 0,
  repair_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_completion_at DATE NULL,
  completed_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_repairs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_repairs_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_repairs_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_repairs_technician FOREIGN KEY (technician_id) REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE KEY uq_repairs_tenant_number (tenant_id, repair_number),
  KEY idx_repairs_tenant (tenant_id),
  KEY idx_repairs_status (status),
  KEY idx_repairs_customer (customer_id),
  KEY idx_repairs_technician (technician_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parts consumed by a repair, always sourced from the tenant's EXISTING
-- products/inventory (never a parallel catalog) — unit_cost/unit_price are
-- snapshots of products.buying_price/selling_price at the moment the part
-- was used, exactly like sale_items.buying_price_snapshot already does for
-- POS sales, so a later product price change never rewrites repair
-- history. No tenant_id column — ownership is always proven through the
-- join to repairs, same pattern pharmacy_sale_items/restaurant_order_items
-- already established this session.
CREATE TABLE IF NOT EXISTS repair_parts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(15,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repair_parts_repair FOREIGN KEY (repair_id) REFERENCES repairs (id) ON DELETE CASCADE,
  CONSTRAINT fk_repair_parts_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_repair_parts_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  KEY idx_repair_parts_repair (repair_id),
  KEY idx_repair_parts_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One authoritative state machine (enforced entirely in repair.service.js,
-- never trust a client-sent status) is still the source of truth for
-- `repairs.status` — this table is its audit trail, not a second copy of
-- the rules.
CREATE TABLE IF NOT EXISTS repair_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(30) NULL,
  to_status VARCHAR(30) NOT NULL,
  notes VARCHAR(500) NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repair_status_history_repair FOREIGN KEY (repair_id) REFERENCES repairs (id) ON DELETE CASCADE,
  CONSTRAINT fk_repair_status_history_user FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE RESTRICT,
  KEY idx_repair_status_history_repair (repair_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partial payments — repairs.amount_paid is the running SUM of these,
-- kept in sync transactionally by repair.service.js, mirroring how
-- pharmacy_sales.total_amount / restaurant_orders.total_amount are each
-- the authoritative header total updated inside their own transactions.
CREATE TABLE IF NOT EXISTS repair_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method ENUM('cash','mobile_money','bank_transfer','card','other') NOT NULL DEFAULT 'cash',
  received_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repair_payments_repair FOREIGN KEY (repair_id) REFERENCES repairs (id) ON DELETE CASCADE,
  CONSTRAINT fk_repair_payments_user FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE RESTRICT,
  KEY idx_repair_payments_repair (repair_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Widen the EXISTING inventory_movements ledger's enum (additive ALTER on
-- an already-applied migration's table, not an edit to that migration
-- file) so repair-parts consumption is honestly categorized in stock
-- history/reports instead of being miscounted as a regular retail sale.
ALTER TABLE inventory_movements
  MODIFY COLUMN movement_type ENUM('purchase','sale','return','transfer_out','transfer_in','adjustment','opening_balance','manual_correction','repair') NOT NULL;

-- ============================================================
-- Module Registry — one brand-new module (next free id after Restaurant's
-- 35-37 is 38). Sales/Products/Inventory/Purchases/Customers/Suppliers/
-- Expenses/Reports are all reused as-is; only Repairs is new.
-- ============================================================
INSERT IGNORE INTO modules (id, `key`, name, icon, route, required_permission, navigation_order, dashboard_widgets, is_core, is_active) VALUES
  (38, 'repairs', 'Repairs', 'FiTool', '/repairs', 'repairs.view', 22,
   '["todayRepairs","pendingDiagnosis","waitingApproval","inRepairCount","readyForCollection","completedRepairsToday","outstandingRepairPayments"]',
   FALSE, TRUE);

INSERT IGNORE INTO template_modules (business_template_id, module_id, is_enabled)
SELECT id, 38, TRUE FROM business_templates WHERE slug = 'electronics-shop';

-- ============================================================
-- Permissions
-- ============================================================
INSERT IGNORE INTO permissions (code, module, action, description) VALUES
  ('repairs.view', 'repairs', 'view', 'View repair jobs and their history'),
  ('repairs.create', 'repairs', 'create', 'Create new repair intakes'),
  ('repairs.manage', 'repairs', 'manage', 'Progress repair status, record parts used, and record payments');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'repairs.view', 'repairs.create', 'repairs.manage'
) WHERE r.name = 'Super Administrator';
