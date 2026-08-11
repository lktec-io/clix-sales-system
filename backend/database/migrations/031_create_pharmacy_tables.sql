-- 031_create_pharmacy_tables.sql
-- Priority 2 of the multi-business build-out: a real Pharmacy Management
-- System (medicines, batch/expiry-tracked stock, FEFO-aware sales,
-- purchases that receive stock into batches). Purely additive — no
-- existing table is altered, no old migration is touched.
--
-- Why dedicated tables instead of extending products/inventory: batch-level
-- stock with per-batch expiry dates changes the INVENTORY GRAIN itself
-- (one row per product per branch today -> one row per BATCH per product
-- per branch for Pharmacy). Retrofitting that onto the shared
-- products/inventory tables would change behavior for every other
-- template's Sales/Purchases/Transfers/Reports, which the regression
-- protection for this phase explicitly forbids. Medicine Categories reuse
-- the existing tenant-scoped `categories` table directly (genuinely
-- reusable, no medicine-specific shape needed) — Customers and Suppliers
-- reuse their existing tables the same way, exactly like Microfinance's
-- borrowers reused `customers`.

CREATE TABLE IF NOT EXISTS medicines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'unit',
  selling_price DECIMAL(15,2) NOT NULL,
  reorder_level INT NOT NULL DEFAULT 0,
  description VARCHAR(500) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_medicines_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_medicines_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
  KEY idx_medicines_tenant (tenant_id),
  KEY idx_medicines_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The actual sellable stock — one row per received batch. `quantity` is the
-- current remaining count in this batch (decremented by FEFO sales, never
-- a separately-tracked "sold" counter to keep drifting out of sync with).
CREATE TABLE IF NOT EXISTS medicine_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  medicine_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NULL,
  batch_number VARCHAR(60) NOT NULL,
  buying_price DECIMAL(15,2) NOT NULL,
  selling_price DECIMAL(15,2) NULL,
  quantity INT NOT NULL DEFAULT 0,
  expiry_date DATE NOT NULL,
  received_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_medicine_batches_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_medicine_batches_medicine FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE RESTRICT,
  CONSTRAINT fk_medicine_batches_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_medicine_batches_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
  UNIQUE KEY uq_medicine_batches_medicine_branch_batch (medicine_id, branch_id, batch_number),
  KEY idx_medicine_batches_tenant (tenant_id),
  KEY idx_medicine_batches_expiry (expiry_date),
  KEY idx_medicine_batches_medicine (medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharmacy_purchases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  purchase_number VARCHAR(30) NOT NULL,
  reference VARCHAR(100) NULL,
  purchase_date DATE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pharmacy_purchases_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_purchases_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_pharmacy_purchases_tenant_number (tenant_id, purchase_number),
  KEY idx_pharmacy_purchases_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharmacy_purchase_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT UNSIGNED NOT NULL,
  medicine_id BIGINT UNSIGNED NOT NULL,
  batch_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  buying_price DECIMAL(15,2) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  CONSTRAINT fk_pharmacy_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES pharmacy_purchases (id) ON DELETE CASCADE,
  CONSTRAINT fk_pharmacy_purchase_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_purchase_items_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches (id) ON DELETE RESTRICT,
  KEY idx_pharmacy_purchase_items_purchase (purchase_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharmacy_sales (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  sale_number VARCHAR(30) NOT NULL,
  payment_method ENUM('cash','mobile_money','bank_transfer','card','other') NOT NULL DEFAULT 'cash',
  status ENUM('completed','voided') NOT NULL DEFAULT 'completed',
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  sold_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pharmacy_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_sales_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_sales_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  UNIQUE KEY uq_pharmacy_sales_tenant_number (tenant_id, sale_number),
  KEY idx_pharmacy_sales_tenant (tenant_id),
  KEY idx_pharmacy_sales_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- batch_id is the FEFO traceability link — which specific batch these units
-- were dispensed from, never just "this medicine" in the abstract.
CREATE TABLE IF NOT EXISTS pharmacy_sale_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  medicine_id BIGINT UNSIGNED NOT NULL,
  batch_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  CONSTRAINT fk_pharmacy_sale_items_sale FOREIGN KEY (sale_id) REFERENCES pharmacy_sales (id) ON DELETE CASCADE,
  CONSTRAINT fk_pharmacy_sale_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_sale_items_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches (id) ON DELETE RESTRICT,
  KEY idx_pharmacy_sale_items_sale (sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit trail mirroring the existing generic `inventory` movement pattern
-- (inventory.repository.js#recordMovement), just batch-aware.
CREATE TABLE IF NOT EXISTS pharmacy_stock_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  medicine_id BIGINT UNSIGNED NOT NULL,
  batch_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('purchase','sale','adjustment') NOT NULL,
  quantity_change INT NOT NULL,
  reference_type VARCHAR(30) NULL,
  reference_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pharmacy_stock_movements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_stock_movements_medicine FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_stock_movements_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_stock_movements_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  KEY idx_pharmacy_stock_movements_tenant (tenant_id),
  KEY idx_pharmacy_stock_movements_medicine (medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Module Registry — activate the Phase 5 Pharmacy placeholders, register
-- Sales/Purchases as Pharmacy-specific modules (labeled plainly "Sales" /
-- "Purchases" in the nav — see sidebar.json — since from the tenant's
-- point of view that's exactly what they are; the underlying `pharmacy_*`
-- module keys just keep them a separate resolution path from the retail
-- sales/purchases modules, which stay untouched for every other template).
-- ============================================================
UPDATE modules SET
  is_active = TRUE,
  route = '/medicines',
  required_permission = 'medicines.view',
  dashboard_widgets = '["totalMedicines","lowStockCount","outOfStockCount","expiredCount","expiringSoonCount","todaySalesCount","todayRevenue"]',
  navigation_order = 6
WHERE `key` = 'medicines';

UPDATE modules SET
  is_active = TRUE,
  route = '/expiry-tracking',
  required_permission = 'medicines.view',
  navigation_order = 9
WHERE `key` = 'expiry';

INSERT IGNORE INTO modules (id, `key`, name, icon, route, required_permission, navigation_order, is_core, is_active) VALUES
  (33, 'pharmacy_sales', 'Sales', 'FiShoppingCart', '/pharmacy/sales', 'pharmacy_sales.view', 7, FALSE, TRUE),
  (34, 'pharmacy_purchases', 'Purchases', 'FiTruck', '/pharmacy/purchases', 'pharmacy_purchases.view', 8, FALSE, TRUE);

-- Pharmacy (business_template_id = 8) currently has every retail module
-- enabled (026_create_module_framework_tables.sql lumped it in with every
-- general-retail-shaped vertical) — drop the ones that don't belong to a
-- real pharmacy workflow. Customers(13)/Suppliers(14)/Expenses(15)/
-- Reports(16) stay exactly as they are.
UPDATE template_modules SET is_enabled = FALSE
WHERE business_template_id = 8 AND module_id IN (7, 8, 9, 10, 11, 12); -- sales, returns, products, inventory, purchases, transfers

-- medicines(19)/expiry(20) rows already exist for template 8 from 026,
-- is_enabled=TRUE — only needed new rows are the two brand-new module ids.
INSERT IGNORE INTO template_modules (business_template_id, module_id, is_enabled) VALUES
  (8, 33, TRUE), -- Pharmacy: Sales
  (8, 34, TRUE); -- Pharmacy: Purchases

-- ============================================================
-- Permissions
-- ============================================================
INSERT IGNORE INTO permissions (code, module, action, description) VALUES
  ('medicines.view', 'medicines', 'view', 'View medicines, batches, stock and expiry tracking'),
  ('medicines.manage', 'medicines', 'manage', 'Create and edit medicines'),
  ('pharmacy_sales.view', 'pharmacy_sales', 'view', 'View pharmacy sales'),
  ('pharmacy_sales.create', 'pharmacy_sales', 'create', 'Dispense/sell medicines'),
  ('pharmacy_purchases.view', 'pharmacy_purchases', 'view', 'View pharmacy purchases'),
  ('pharmacy_purchases.create', 'pharmacy_purchases', 'create', 'Receive medicine stock');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'medicines.view', 'medicines.manage',
  'pharmacy_sales.view', 'pharmacy_sales.create',
  'pharmacy_purchases.view', 'pharmacy_purchases.create'
) WHERE r.name = 'Super Administrator';
