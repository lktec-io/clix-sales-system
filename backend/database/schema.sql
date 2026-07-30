-- schema.sql — Clix Sales System full schema (generated from migrations/001..010)
-- Apply migrations/*.sql individually if you prefer incremental control; this is the one-shot equivalent.
-- Run seeders/*.sql separately afterward for reference data.

-- ============================================================
-- 001_create_roles_permissions.sql
-- ============================================================
-- 001_create_roles_permissions.sql
-- Roles, permissions and the role/permission join table. No dependencies.
-- created_by/updated_by FKs to users are added later in 002 (users does not exist yet).

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_permissions_code (code),
  KEY idx_permissions_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pure join table: no audit columns, rows are inserted/deleted, never updated.
CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_role_permissions (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 002_create_branches_users.sql
-- ============================================================
-- 002_create_branches_users.sql
-- branches and users reference each other (branches.manager_id -> users.id,
-- users.branch_id -> branches.id). Resolve the cycle by creating branches
-- without the manager FK first, then users, then adding the deferred FKs.

CREATE TABLE IF NOT EXISTS branches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  manager_id BIGINT UNSIGNED NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(255) NULL,
  region VARCHAR(100) NULL,
  district VARCHAR(100) NULL,
  opening_date DATE NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_branches_code (code),
  KEY idx_branches_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  gender ENUM('male','female','other') NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  avatar_path VARCHAR(255) NULL,
  status ENUM('active','suspended','locked') NOT NULL DEFAULT 'active',
  failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_phone (phone),
  KEY idx_users_role (role_id),
  KEY idx_users_branch (branch_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Many-to-many: Managers assigned to multiple branches. users.branch_id remains the primary/default branch.
CREATE TABLE IF NOT EXISTS user_branches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_branches (user_id, branch_id),
  CONSTRAINT fk_user_branches_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_branches_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Deferred FKs now that both tables exist.
ALTER TABLE branches
  ADD CONSTRAINT fk_branches_manager FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_branches_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_branches_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE roles
  ADD CONSTRAINT fk_roles_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_roles_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE permissions
  ADD CONSTRAINT fk_permissions_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_permissions_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

-- ============================================================
-- 003_create_settings_sessions.sql
-- ============================================================
-- 003_create_settings_sessions.sql
-- Company profile, system settings, and auth session/token tables.

CREATE TABLE IF NOT EXISTS company_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL,
  business_type VARCHAR(100) NULL,
  tin_number VARCHAR(50) NULL,
  vrn VARCHAR(50) NULL,
  registration_number VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  region VARCHAR(100) NULL,
  district VARCHAR(100) NULL,
  street VARCHAR(150) NULL,
  phone VARCHAR(20) NULL,
  alt_phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  website VARCHAR(150) NULL,
  logo_path VARCHAR(255) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  receipt_footer TEXT NULL,
  description TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_company_settings_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_company_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL,
  setting_value VARCHAR(500) NULL,
  data_type ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_system_settings_key (setting_key),
  CONSTRAINT fk_system_settings_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_system_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  device_label VARCHAR(100) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  session_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_session FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_password_resets_hash (token_hash),
  KEY idx_password_resets_user (user_id),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 004_create_catalog_inventory.sql
-- ============================================================
-- 004_create_catalog_inventory.sql
-- Categories, brands, products (shared catalog), and per-branch inventory
-- with its movement ledger. Inventory is the single source of truth for stock.

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  description VARCHAR(255) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_code (code),
  CONSTRAINT fk_categories_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brands (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  description VARCHAR(255) NULL,
  country VARCHAR(100) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_brands_name (name),
  UNIQUE KEY uq_brands_code (code),
  CONSTRAINT fk_brands_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_brands_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reusable numbering engine for product codes, sale/purchase/transfer/return numbers.
CREATE TABLE IF NOT EXISTS document_sequences (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_type VARCHAR(30) NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_document_sequences (document_type, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  brand_id BIGINT UNSIGNED NOT NULL,
  description TEXT NULL,
  buying_price DECIMAL(14,2) NOT NULL,
  selling_price DECIMAL(14,2) NOT NULL,
  min_stock INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_products_code (code),
  KEY idx_products_category (category_id),
  KEY idx_products_brand (brand_id),
  FULLTEXT KEY ftx_products_name (name),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands (id) ON DELETE RESTRICT,
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_products_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_product_images_product (product_id),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qr_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  qr_path VARCHAR(255) NOT NULL,
  payload JSON NULL,
  regenerated_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_qr_codes_product (product_id),
  CONSTRAINT fk_qr_codes_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-branch stock. Never written to directly by forms — only via the Inventory Service
-- reacting to a movement (purchase/sale/return/transfer/adjustment).
CREATE TABLE IF NOT EXISTS inventory (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  reserved_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  min_stock INT UNSIGNED NULL,
  max_stock INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inventory_product_branch (product_id, branch_id),
  KEY idx_inventory_branch (branch_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT chk_inventory_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT chk_inventory_reserved_non_negative CHECK (reserved_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Immutable ledger: insert-only, no soft delete, no update after insert.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('purchase','sale','return','transfer_out','transfer_in','adjustment','opening_balance','manual_correction') NOT NULL,
  quantity_change INT NOT NULL,
  previous_stock INT UNSIGNED NOT NULL,
  new_stock INT UNSIGNED NOT NULL,
  reference_type VARCHAR(30) NULL,
  reference_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_movements_product_branch_date (product_id, branch_id, created_at),
  KEY idx_inventory_movements_reference (reference_type, reference_id),
  CONSTRAINT fk_inventory_movements_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movements_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movements_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  movement_id BIGINT UNSIGNED NOT NULL,
  reason ENUM('damaged','expired','lost','correction','initial_count','system_error') NOT NULL,
  description VARCHAR(500) NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  KEY idx_inventory_adjustments_product_branch (product_id, branch_id),
  CONSTRAINT fk_inventory_adjustments_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_adjustments_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_adjustments_movement FOREIGN KEY (movement_id) REFERENCES inventory_movements (id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_adjustments_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_inventory_adjustments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 005_create_purchases_suppliers.sql
-- ============================================================
-- 005_create_purchases_suppliers.sql

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(255) NULL,
  tin_number VARCHAR(50) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  KEY idx_suppliers_status (status),
  CONSTRAINT fk_suppliers_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_suppliers_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_number VARCHAR(30) NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('pending','received','cancelled') NOT NULL DEFAULT 'received',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_purchase_orders_number (purchase_number),
  KEY idx_purchase_orders_supplier (supplier_id),
  KEY idx_purchase_orders_branch_date (branch_id, created_at),
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_orders_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_orders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_purchase_orders_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  buying_price DECIMAL(14,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_purchase_items_order (purchase_order_id),
  KEY idx_purchase_items_product (product_id),
  CONSTRAINT fk_purchase_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_items_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NULL,
  amount DECIMAL(14,2) NOT NULL,
  payment_method ENUM('cash','mpesa','airtel_money','bank_transfer') NOT NULL,
  paid_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  KEY idx_supplier_payments_supplier (supplier_id),
  KEY idx_supplier_payments_order (purchase_order_id),
  CONSTRAINT fk_supplier_payments_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_supplier_payments_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE SET NULL,
  CONSTRAINT fk_supplier_payments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 006_create_sales_pos.sql
-- ============================================================
-- 006_create_sales_pos.sql
-- Customers, sales (POS checkout), and returns.

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_code VARCHAR(20) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  business_name VARCHAR(150) NULL,
  phone VARCHAR(20) NOT NULL,
  alt_phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(255) NULL,
  region VARCHAR(100) NULL,
  district VARCHAR(100) NULL,
  tin_number VARCHAR(50) NULL,
  customer_type ENUM('walk_in','retail','wholesale','vip','business') NOT NULL DEFAULT 'walk_in',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_customers_code (customer_code),
  UNIQUE KEY uq_customers_phone (phone),
  KEY idx_customers_type (customer_type),
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_number VARCHAR(30) NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  cashier_id BIGINT UNSIGNED NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes VARCHAR(255) NULL,
  status ENUM('completed','voided') NOT NULL DEFAULT 'completed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sales_number (sale_number),
  KEY idx_sales_branch_date (branch_id, created_at),
  KEY idx_sales_customer (customer_id),
  KEY idx_sales_cashier (cashier_id),
  CONSTRAINT fk_sales_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sale_items_sale (sale_id),
  KEY idx_sale_items_product (product_id),
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT chk_sale_items_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  payment_method ENUM('cash','mpesa','airtel_money','bank_transfer','card') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference_number VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sale_payments_sale (sale_id),
  CONSTRAINT fk_sale_payments_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS returns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_number VARCHAR(30) NOT NULL,
  sale_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  reason ENUM('damaged','wrong_item','changed_mind','expired','other') NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  refund_amount DECIMAL(14,2) NULL,
  refund_method ENUM('cash','mpesa','airtel_money','bank_transfer') NULL,
  refund_status ENUM('pending','refunded') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_returns_number (return_number),
  KEY idx_returns_sale (sale_id),
  KEY idx_returns_status (status),
  CONSTRAINT fk_returns_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE RESTRICT,
  CONSTRAINT fk_returns_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_returns_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_returns_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS return_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id BIGINT UNSIGNED NOT NULL,
  sale_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_return_items_return (return_id),
  KEY idx_return_items_sale_item (sale_item_id),
  CONSTRAINT fk_return_items_return FOREIGN KEY (return_id) REFERENCES returns (id) ON DELETE CASCADE,
  CONSTRAINT fk_return_items_sale_item FOREIGN KEY (sale_item_id) REFERENCES sale_items (id) ON DELETE RESTRICT,
  CONSTRAINT chk_return_items_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 007_create_stock_transfers.sql
-- ============================================================
-- 007_create_stock_transfers.sql

CREATE TABLE IF NOT EXISTS stock_transfer_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transfer_number VARCHAR(30) NOT NULL,
  source_branch_id BIGINT UNSIGNED NOT NULL,
  destination_branch_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  requested_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stock_transfer_requests_number (transfer_number),
  KEY idx_stock_transfer_requests_source (source_branch_id),
  KEY idx_stock_transfer_requests_destination (destination_branch_id),
  KEY idx_stock_transfer_requests_status (status),
  CONSTRAINT fk_stock_transfer_requests_source FOREIGN KEY (source_branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_transfer_requests_destination FOREIGN KEY (destination_branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_transfer_requests_requested_by FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_transfer_requests_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_stock_transfer_requests_diff_branch CHECK (source_branch_id <> destination_branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transfer_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_stock_transfer_items_transfer (transfer_id),
  KEY idx_stock_transfer_items_product (product_id),
  CONSTRAINT fk_stock_transfer_items_transfer FOREIGN KEY (transfer_id) REFERENCES stock_transfer_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_transfer_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT chk_stock_transfer_items_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 008_create_expenses.sql
-- ============================================================
-- 008_create_expenses.sql

CREATE TABLE IF NOT EXISTS expense_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_expense_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expense_category_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  description VARCHAR(255) NULL,
  receipt_path VARCHAR(255) NULL,
  paid_by BIGINT UNSIGNED NULL,
  expense_date DATE NOT NULL,
  status ENUM('pending','approved') NOT NULL DEFAULT 'approved',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  KEY idx_expenses_branch_date (branch_id, expense_date),
  KEY idx_expenses_category (expense_category_id),
  CONSTRAINT fk_expenses_category FOREIGN KEY (expense_category_id) REFERENCES expense_categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_expenses_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_expenses_paid_by FOREIGN KEY (paid_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 010_create_notifications_logs.sql
-- ============================================================
-- 010_create_notifications_logs.sql
-- Notifications, activity timeline, audit trail, email log, backup history.

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  type ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
  category ENUM('low_stock','purchase_completed','sale_completed','transfer_completed','expense_submitted','expense_approved','return_processed','system_error') NOT NULL,
  title VARCHAR(150) NOT NULL,
  message VARCHAR(500) NOT NULL,
  reference_type VARCHAR(30) NULL,
  reference_id BIGINT UNSIGNED NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_user (user_id),
  KEY idx_notifications_read (read_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Human-readable dashboard timeline feed. Insert-only.
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  reference_type VARCHAR(30) NULL,
  reference_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activity_logs_branch_date (branch_id, created_at),
  KEY idx_activity_logs_user (user_id),
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_activity_logs_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compliance/forensic trail. Insert-only, never updated.
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id BIGINT UNSIGNED NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  ip_address VARCHAR(45) NULL,
  branch_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_logs_table_record (table_name, record_id),
  KEY idx_audit_logs_user (user_id),
  KEY idx_audit_logs_date (created_at),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_audit_logs_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  to_email VARCHAR(150) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  template VARCHAR(100) NULL,
  status ENUM('sent','failed') NOT NULL,
  error_message VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_email_logs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_backups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_path VARCHAR(255) NOT NULL,
  size_bytes BIGINT UNSIGNED NULL,
  trigger_type ENUM('manual','scheduled') NOT NULL,
  status ENUM('success','failed') NOT NULL,
  triggered_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_system_backups_status (status),
  CONSTRAINT fk_system_backups_triggered_by FOREIGN KEY (triggered_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

