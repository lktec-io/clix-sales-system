-- 026_create_module_framework_tables.sql
-- Phase 5 — Business Templates & Dynamic Module Framework. Introduces a
-- global module registry, business templates, template->module mapping,
-- template default settings, and a per-tenant module override. This is a
-- configuration/framework layer only — it decides what's VISIBLE and
-- REACHABLE for a tenant; the existing permission system (001_create_roles_
-- permissions.sql onward) continues to decide what's ALLOWED. Modules never
-- replace permissions — every toggleable module's `required_permission`
-- column points at a permission code that already exists and is enforced
-- exactly as before.
--
-- No Sales/Inventory/Purchasing business logic changes here — these tables
-- are read by a new cached resolver (moduleResolution.service.js) and a new
-- narrow middleware (requireModule.js), never by the existing handlers.

CREATE TABLE IF NOT EXISTS modules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) NULL,
  route VARCHAR(150) NULL,
  required_permission VARCHAR(255) NULL,
  navigation_order INT NOT NULL DEFAULT 0,
  dashboard_widgets JSON NULL,
  dependencies JSON NULL,
  is_core BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_modules_key (`key`),
  KEY idx_modules_active_core (is_active, is_core)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  status ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_business_templates_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A row records a template's explicit decision for a module — toggling
-- Enable/Disable (Step 8) flips is_enabled, it never inserts/deletes a row.
-- ABSENCE of a row for a (template, module) pair means "disabled" — a safe
-- default-deny, and why School/Microfinance/SACCOS's seed data below only
-- lists the modules they DO enable.
CREATE TABLE IF NOT EXISTS template_modules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_template_id BIGINT UNSIGNED NOT NULL,
  module_id BIGINT UNSIGNED NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order_override INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_template_modules_template_module (business_template_id, module_id),
  KEY idx_template_modules_module (module_id),
  CONSTRAINT fk_template_modules_template FOREIGN KEY (business_template_id) REFERENCES business_templates (id) ON DELETE CASCADE,
  CONSTRAINT fk_template_modules_module FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Template-level defaults (Step 10) — copied ONCE into a tenant's own
-- system_settings at template-assignment time (see
-- businessTemplateAssignment.service.js), never live-linked, so a tenant's
-- later customization is never overwritten by a future template edit.
CREATE TABLE IF NOT EXISTS template_default_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_template_id BIGINT UNSIGNED NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value VARCHAR(500) NULL,
  data_type ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_template_default_settings_template_key (business_template_id, setting_key),
  CONSTRAINT fk_template_default_settings_template FOREIGN KEY (business_template_id) REFERENCES business_templates (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-tenant override (Step 8) — a row here wins over the tenant's
-- template's template_modules row for that module. No row means "use the
-- template's setting." This is how a platform admin can, e.g., disable
-- Expenses for one specific Retail tenant without affecting any other
-- Retail tenant (tenant isolation preserved).
CREATE TABLE IF NOT EXISTS tenant_modules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  module_id BIGINT UNSIGNED NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_modules_tenant_module (tenant_id, module_id),
  KEY idx_tenant_modules_module (module_id),
  CONSTRAINT fk_tenant_modules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_modules_module FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Seed: module registry
-- ============================================================
-- Deterministic ids (1-16 real, 17-29 future/inert) so the template_modules
-- seed below can reference them by literal id — same idiom as tenant id=1,
-- subscription_plans ids 1-3 in earlier phases.
--
-- Core modules (is_core=TRUE) are ALWAYS enabled for every tenant
-- regardless of template/override, and are never gated at the API layer —
-- they already work purely off the existing permission system today, and
-- gating them risks locking a tenant out of their own account management
-- (see the Phase 5 plan's "Key design decisions").
-- branches/users/permissions/notifications intentionally get route=NULL —
-- exactly matching the CURRENT static sidebar, which reaches these only via
-- Settings sub-pages or the Navbar, never as their own top-level link (see
-- the comment this migration's frontend counterpart, Sidebar.jsx, already
-- carried before Phase 5). A dynamic sidebar driven by "has a route" would
-- otherwise silently add three new top-level links that never existed
-- before — a visible nav change for every existing tenant, which Step 15
-- explicitly guards against ("Existing Retail tenants continue working").
INSERT IGNORE INTO modules (id, `key`, name, icon, route, required_permission, navigation_order, dashboard_widgets, is_core, is_active) VALUES
  (1, 'dashboard', 'Dashboard', 'FiGrid', '/dashboard', NULL, 1, NULL, TRUE, TRUE),
  (2, 'branches', 'Branches', 'FiMapPin', NULL, 'branches.view', 100, NULL, TRUE, TRUE),
  (3, 'users', 'Users', 'FiUsers', NULL, 'users.view', 101, NULL, TRUE, TRUE),
  (4, 'permissions', 'Permissions', 'FiShield', NULL, 'roles.view', 102, NULL, TRUE, TRUE),
  (5, 'settings', 'Settings', 'FiSettings', '/settings/company', 'company.manage,settings.view', 110, NULL, TRUE, TRUE),
  (6, 'notifications', 'Notifications', 'FiBell', NULL, NULL, 999, NULL, TRUE, TRUE),
  (7, 'sales', 'Sales', 'FiDollarSign', '/pos', 'sales.view', 10, '["todaySales","monthlySales","monthlyProfit","todayOrders","salesTrend","paymentStatus","topProducts"]', FALSE, TRUE),
  (8, 'returns', 'Returns', 'FiRotateCcw', '/returns', 'returns.view', 11, NULL, FALSE, TRUE),
  (9, 'products', 'Products', 'FiBox', '/products', 'products.view', 20, NULL, FALSE, TRUE),
  (10, 'inventory', 'Inventory', 'FiArchive', '/inventory', 'inventory.view', 21, '["lowStockCount","lowStockAlert"]', FALSE, TRUE),
  (11, 'purchases', 'Purchases', 'FiShoppingCart', '/purchases', 'purchases.view', 30, NULL, FALSE, TRUE),
  (12, 'transfers', 'Stock Transfers', 'FiRepeat', NULL, 'transfers.view', 998, NULL, FALSE, TRUE),
  (13, 'customers', 'Customers', 'FiUserCheck', '/customers', 'customers.view', 5, NULL, FALSE, TRUE),
  (14, 'suppliers', 'Suppliers', 'FiTruck', '/suppliers', 'suppliers.view', 25, NULL, FALSE, TRUE),
  (15, 'expenses', 'Expenses', 'FiDollarSign', '/expenses', 'expenses.view', 40, '["revenueVsExpenses"]', FALSE, TRUE),
  (16, 'reports', 'Reports', 'FiBarChart2', '/reports', 'reports.view', 50, NULL, FALSE, TRUE);

-- Future modules (Step 2's own list) — inert placeholders. Present in the
-- registry (satisfies "must be fully configurable") but is_active=FALSE
-- means they never surface for any tenant no matter what a template or
-- tenant override says, until a future phase builds the real feature and
-- flips this flag.
INSERT IGNORE INTO modules (id, `key`, name, icon, route, required_permission, navigation_order, is_core, is_active) VALUES
  (17, 'students', 'Students', 'FiUsers', NULL, NULL, 200, FALSE, FALSE),
  (18, 'teachers', 'Teachers', 'FiUsers', NULL, NULL, 201, FALSE, FALSE),
  (19, 'medicines', 'Medicines', 'FiBox', NULL, NULL, 202, FALSE, FALSE),
  (20, 'expiry', 'Expiry Tracking', 'FiClock', NULL, NULL, 203, FALSE, FALSE),
  (21, 'kitchen', 'Kitchen', 'FiBox', NULL, NULL, 204, FALSE, FALSE),
  (22, 'loans', 'Loans', 'FiDollarSign', NULL, NULL, 205, FALSE, FALSE),
  (23, 'savings', 'Savings', 'FiDollarSign', NULL, NULL, 206, FALSE, FALSE),
  (24, 'members', 'Members', 'FiUserCheck', NULL, NULL, 207, FALSE, FALSE),
  (25, 'attendance', 'Attendance', 'FiCheckCircle', NULL, NULL, 208, FALSE, FALSE),
  (26, 'fees', 'Fees', 'FiDollarSign', NULL, NULL, 209, FALSE, FALSE),
  (27, 'payroll', 'Payroll', 'FiDollarSign', NULL, NULL, 210, FALSE, FALSE),
  (28, 'hr', 'HR', 'FiUsers', NULL, NULL, 211, FALSE, FALSE),
  (29, 'accounting', 'Accounting', 'FiBarChart2', NULL, NULL, 212, FALSE, FALSE);

-- ============================================================
-- Seed: business templates
-- ============================================================
-- Retail Store = id 1, deterministic — 027_assign_default_business_template
-- .sql's ALTER TABLE tenants ... DEFAULT 1 depends on this exact id.
INSERT IGNORE INTO business_templates (id, name, slug, description, status) VALUES
  (1, 'Retail Store', 'retail-store', 'General retail — the platform default.', 'active'),
  (2, 'General Business', 'general-business', 'A generic catch-all for businesses that don''t fit a specific vertical.', 'active'),
  (3, 'Wholesale Store', 'wholesale-store', 'Bulk sales to other businesses.', 'active'),
  (4, 'Hardware Store', 'hardware-store', 'Tools, building materials, and hardware retail.', 'active'),
  (5, 'Electronics Shop', 'electronics-shop', 'Consumer electronics retail.', 'active'),
  (6, 'Clothing Store', 'clothing-store', 'Apparel and fashion retail.', 'active'),
  (7, 'Cosmetics Shop', 'cosmetics-shop', 'Beauty and cosmetics retail.', 'active'),
  (8, 'Pharmacy', 'pharmacy', 'Retail pharmacy — Medicines and Expiry tracking activate once built (Phase 6+).', 'active'),
  (9, 'Restaurant', 'restaurant', 'Food service — Kitchen management activates once built (Phase 6+).', 'active'),
  (10, 'School', 'school', 'Educational institution — Students/Teachers/Attendance/Fees activate once built (Phase 6+).', 'active'),
  (11, 'Microfinance', 'microfinance', 'Microfinance institution — Loans/Savings/Members activate once built (Phase 6+).', 'active'),
  (12, 'SACCOS', 'saccos', 'Savings and Credit Cooperative — Members/Savings/Loans activate once built (Phase 6+).', 'active');

-- ============================================================
-- Seed: template -> module mapping
-- ============================================================
-- Templates 1-9 (every general-retail-shaped vertical, including Pharmacy
-- and Restaurant today, since Medicines/Expiry/Kitchen don't exist yet) get
-- every real toggleable module enabled — this is the exact existing
-- behavior every current tenant already has, preserved byte-for-byte.
INSERT INTO template_modules (business_template_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
FROM business_templates t
CROSS JOIN modules m
WHERE t.id IN (1,2,3,4,5,6,7,8,9)
  AND m.is_core = FALSE
  AND m.id BETWEEN 7 AND 16;

-- Pharmacy (8) and Restaurant (9) additionally map their real-world future
-- modules now, at is_enabled=TRUE — inert today (modules.is_active=FALSE),
-- but the instant Phase 6 ships Medicines/Expiry/Kitchen and flips that
-- flag, these tenants light up with zero further template reconfiguration.
INSERT INTO template_modules (business_template_id, module_id, is_enabled) VALUES
  (8, 19, TRUE), (8, 20, TRUE),
  (9, 21, TRUE);

-- School (10), Microfinance (11), SACCOS (12) — genuinely sparse real-module
-- sets (a school doesn't run retail sales/inventory/purchases), each with
-- its own future-module mapping ready for Phase 6+.
INSERT INTO template_modules (business_template_id, module_id, is_enabled) VALUES
  (10, 16, TRUE), -- School: Reports
  (10, 17, TRUE), (10, 18, TRUE), (10, 25, TRUE), (10, 26, TRUE), -- Students, Teachers, Attendance, Fees
  (11, 16, TRUE), (11, 13, TRUE), (11, 15, TRUE), -- Microfinance: Reports, Customers, Expenses
  (11, 22, TRUE), (11, 23, TRUE), (11, 24, TRUE), -- Loans, Savings, Members
  (12, 16, TRUE), (12, 13, TRUE), (12, 15, TRUE), -- SACCOS: Reports, Customers, Expenses
  (12, 24, TRUE), (12, 23, TRUE), (12, 22, TRUE); -- Members, Savings, Loans
