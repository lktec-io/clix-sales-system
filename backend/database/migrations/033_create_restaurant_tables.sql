-- 033_create_restaurant_tables.sql
-- Priority 3 of the multi-business build-out: a real Restaurant Management
-- System (menu catalog, dine-in table tracking, an order lifecycle that
-- flows from the floor to the kitchen and back, and payment on close).
-- Purely additive — no existing table is altered, no old migration is
-- touched.
--
-- Reuse, same principle as Pharmacy (031): menu categories reuse the
-- existing tenant-scoped `categories` table directly (no restaurant-specific
-- shape needed), and restaurant guests reuse `customers` the same way
-- Pharmacy's customers and Microfinance's borrowers did. Menu items, tables,
-- orders and order items are genuinely new concepts with their own grain —
-- dedicated tables, mirroring Pharmacy's reasoning for medicine_batches.
--
-- Deliberately NOT built: recipe/ingredient consumption, raw-stock
-- deduction, split/partial payments, table reservations calendar, printer
-- integration. None of those were asked for and a menu item here has no
-- stock to track — "available/unavailable" is a manual toggle, not a
-- computed inventory state. Keeping this lean is the explicit brief.

CREATE TABLE IF NOT EXISTS menu_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  selling_price DECIMAL(15,2) NOT NULL,
  description VARCHAR(500) NULL,
  image_url VARCHAR(500) NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_menu_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
  KEY idx_menu_items_tenant (tenant_id),
  KEY idx_menu_items_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  table_number VARCHAR(30) NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  status ENUM('available','occupied','reserved') NOT NULL DEFAULT 'available',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_restaurant_tables_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_restaurant_tables_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_restaurant_tables_branch_number (branch_id, table_number),
  KEY idx_restaurant_tables_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One authoritative header-level state machine, enforced entirely in
-- restaurantOrder.service.js (never trust a client-sent status):
--   open -> sent_to_kitchen -> preparing -> ready -> served -> paid -> completed
-- with `cancelled` reachable from any non-terminal state. `preparing`/`ready`
-- are auto-derived from the order's own items' kitchen_status (see
-- restaurant_order_items below) as kitchen staff work through them, not
-- separately settable by the waiter.
CREATE TABLE IF NOT EXISTS restaurant_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  table_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  order_number VARCHAR(30) NOT NULL,
  status ENUM('open','sent_to_kitchen','preparing','ready','served','paid','completed','cancelled') NOT NULL DEFAULT 'open',
  payment_method ENUM('cash','mobile_money','bank_transfer','card','other') NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  opened_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_restaurant_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_restaurant_orders_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_restaurant_orders_table FOREIGN KEY (table_id) REFERENCES restaurant_tables (id) ON DELETE SET NULL,
  CONSTRAINT fk_restaurant_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  UNIQUE KEY uq_restaurant_orders_tenant_number (tenant_id, order_number),
  KEY idx_restaurant_orders_tenant (tenant_id),
  KEY idx_restaurant_orders_status (status),
  KEY idx_restaurant_orders_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- kitchen_status is the per-item workflow the Kitchen screen actually
-- drives (new -> preparing -> ready -> served) — item-granular because two
-- dishes on the same ticket rarely finish cooking at the same moment; the
-- header's own `preparing`/`ready` status is rolled up from these.
CREATE TABLE IF NOT EXISTS restaurant_order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  kitchen_status ENUM('new','preparing','ready','served') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_restaurant_order_items_order FOREIGN KEY (order_id) REFERENCES restaurant_orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_restaurant_order_items_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE RESTRICT,
  KEY idx_restaurant_order_items_order (order_id),
  KEY idx_restaurant_order_items_kitchen_status (kitchen_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Module Registry — activate the Phase 5 Restaurant placeholder (Kitchen),
-- register Menu/Tables/Orders as brand-new Restaurant-specific modules.
-- Next free module ids after Microfinance (30-32) and Pharmacy (33-34) are
-- 35+.
-- ============================================================
UPDATE modules SET
  is_active = TRUE,
  route = '/kitchen',
  required_permission = 'kitchen.view',
  navigation_order = 22
WHERE `key` = 'kitchen';

INSERT IGNORE INTO modules (id, `key`, name, icon, route, required_permission, navigation_order, dashboard_widgets, is_core, is_active) VALUES
  (35, 'menu', 'Menu', 'FiCoffee', '/menu', 'menu_items.view', 20, NULL, FALSE, TRUE),
  (36, 'tables', 'Tables', 'FiGrid', '/tables', 'restaurant_tables.view', 21, '["occupiedTables","availableTables"]', FALSE, TRUE),
  (37, 'restaurant_orders', 'Orders', 'FiShoppingCart', '/restaurant/orders', 'restaurant_orders.view', 10, '["todaySales","todayOrders","pendingKitchenOrders","completedOrdersToday"]', FALSE, TRUE);

-- Restaurant (business_template_id = 9) currently has every retail module
-- enabled (026_create_module_framework_tables.sql lumped it in with every
-- general-retail-shaped vertical) — drop the ones that don't belong to a
-- real restaurant workflow. Customers(13)/Expenses(15)/Reports(16) stay.
UPDATE template_modules SET is_enabled = FALSE
WHERE business_template_id = 9 AND module_id IN (7, 8, 9, 10, 11, 12, 14); -- sales, returns, products, inventory, purchases, transfers, suppliers

-- kitchen(21) row already exists for template 9 from 026, is_enabled=TRUE —
-- only the 3 brand-new module ids need a new template_modules row.
INSERT IGNORE INTO template_modules (business_template_id, module_id, is_enabled) VALUES
  (9, 35, TRUE), -- Restaurant: Menu
  (9, 36, TRUE), -- Restaurant: Tables
  (9, 37, TRUE); -- Restaurant: Orders

-- ============================================================
-- Permissions
-- ============================================================
INSERT IGNORE INTO permissions (code, module, action, description) VALUES
  ('menu_items.view', 'menu_items', 'view', 'View menu categories and items'),
  ('menu_items.manage', 'menu_items', 'manage', 'Create and edit menu items'),
  ('restaurant_tables.view', 'restaurant_tables', 'view', 'View restaurant tables'),
  ('restaurant_tables.manage', 'restaurant_tables', 'manage', 'Create and edit restaurant tables'),
  ('restaurant_orders.view', 'restaurant_orders', 'view', 'View restaurant orders'),
  ('restaurant_orders.create', 'restaurant_orders', 'create', 'Open new restaurant orders'),
  ('restaurant_orders.manage', 'restaurant_orders', 'manage', 'Send to kitchen, serve, record payment, complete or cancel orders'),
  ('kitchen.view', 'kitchen', 'view', 'View incoming kitchen tickets'),
  ('kitchen.manage', 'kitchen', 'manage', 'Update kitchen preparation status');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'menu_items.view', 'menu_items.manage',
  'restaurant_tables.view', 'restaurant_tables.manage',
  'restaurant_orders.view', 'restaurant_orders.create', 'restaurant_orders.manage',
  'kitchen.view', 'kitchen.manage'
) WHERE r.name = 'Super Administrator';
