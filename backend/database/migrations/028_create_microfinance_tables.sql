-- 028_create_microfinance_tables.sql
-- Priority 1 of the multi-business build-out: a real Microfinance
-- Management System (loan products, loan applications -> approval ->
-- disbursement, repayment schedules, repayments, guarantors, savings,
-- group lending). Purely additive — no existing table is altered, no old
-- migration is touched. Every new table is tenant-scoped (tenant_id +
-- FK to tenants), mirroring 018_add_tenant_id_to_business_tables.sql's own
-- convention exactly. Borrowers reuse the existing `customers` table
-- (already tenant-scoped, already has name/phone/address) rather than a
-- duplicate borrower table — the Microfinance module map below reuses the
-- existing Customers module, not a new one.

CREATE TABLE IF NOT EXISTS loan_products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  min_amount DECIMAL(15,2) NOT NULL,
  max_amount DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(6,3) NOT NULL,
  interest_method ENUM('flat','reducing') NOT NULL DEFAULT 'flat',
  duration_value INT NOT NULL,
  duration_unit ENUM('days','weeks','months') NOT NULL DEFAULT 'months',
  repayment_frequency ENUM('daily','weekly','monthly') NOT NULL DEFAULT 'monthly',
  processing_fee_percent DECIMAL(6,3) NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_loan_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  KEY idx_loan_products_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  loan_number VARCHAR(30) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  loan_product_id BIGINT UNSIGNED NOT NULL,
  requested_amount DECIMAL(15,2) NOT NULL,
  approved_amount DECIMAL(15,2) NULL,
  -- Snapshotted from the loan product at application time so a later edit
  -- to the product's own rate/terms never rewrites an in-flight or
  -- historical loan's actual terms.
  interest_rate DECIMAL(6,3) NOT NULL,
  interest_method ENUM('flat','reducing') NOT NULL,
  duration_value INT NOT NULL,
  duration_unit ENUM('days','weeks','months') NOT NULL,
  repayment_frequency ENUM('daily','weekly','monthly') NOT NULL,
  processing_fee_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  purpose VARCHAR(255) NULL,
  status ENUM('submitted','under_review','approved','rejected','disbursed','active','completed','defaulted','written_off') NOT NULL DEFAULT 'submitted',
  rejection_reason VARCHAR(255) NULL,
  -- Running balances, maintained by loan.service.js on disbursement and on
  -- every repayment allocation — never recomputed ad hoc by a report query,
  -- so "outstanding balance" always means the same thing everywhere it's read.
  principal_outstanding DECIMAL(15,2) NOT NULL DEFAULT 0,
  interest_outstanding DECIMAL(15,2) NOT NULL DEFAULT 0,
  applied_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  disbursed_by BIGINT UNSIGNED NULL,
  disbursed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_loans_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  CONSTRAINT fk_loans_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_loans_product FOREIGN KEY (loan_product_id) REFERENCES loan_products (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_loans_tenant_number (tenant_id, loan_number),
  KEY idx_loans_tenant (tenant_id),
  KEY idx_loans_customer (customer_id),
  KEY idx_loans_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_guarantors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  loan_id BIGINT UNSIGNED NOT NULL,
  -- Nullable: a guarantor is very often not themselves a system customer —
  -- when they are, customer_id links the record; either way name/phone are
  -- always captured directly so the guarantor is identifiable regardless.
  customer_id BIGINT UNSIGNED NULL,
  guarantor_name VARCHAR(150) NOT NULL,
  guarantor_phone VARCHAR(30) NULL,
  guaranteed_amount DECIMAL(15,2) NOT NULL,
  status ENUM('active','released') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_guarantors_loan FOREIGN KEY (loan_id) REFERENCES loans (id) ON DELETE CASCADE,
  CONSTRAINT fk_loan_guarantors_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  KEY idx_loan_guarantors_loan (loan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_schedules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  loan_id BIGINT UNSIGNED NOT NULL,
  installment_number INT NOT NULL,
  due_date DATE NOT NULL,
  principal_due DECIMAL(15,2) NOT NULL,
  interest_due DECIMAL(15,2) NOT NULL,
  fees_due DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_due DECIMAL(15,2) NOT NULL,
  amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_schedules_loan FOREIGN KEY (loan_id) REFERENCES loans (id) ON DELETE CASCADE,
  UNIQUE KEY uq_loan_schedules_loan_installment (loan_id, installment_number),
  KEY idx_loan_schedules_loan (loan_id),
  KEY idx_loan_schedules_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_repayments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  loan_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  receipt_number VARCHAR(30) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method ENUM('cash','mobile_money','bank_transfer','cheque','other') NOT NULL DEFAULT 'cash',
  reference VARCHAR(100) NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_repayments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_loan_repayments_loan FOREIGN KEY (loan_id) REFERENCES loans (id) ON DELETE RESTRICT,
  CONSTRAINT fk_loan_repayments_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_loan_repayments_tenant_receipt (tenant_id, receipt_number),
  KEY idx_loan_repayments_loan (loan_id),
  KEY idx_loan_repayments_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A single repayment commonly settles (or partially settles) more than one
-- installment — this is a proper allocation table rather than a single
-- schedule_id column on loan_repayments, which couldn't represent that.
CREATE TABLE IF NOT EXISTS loan_repayment_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  loan_repayment_id BIGINT UNSIGNED NOT NULL,
  loan_schedule_id BIGINT UNSIGNED NOT NULL,
  amount_applied DECIMAL(15,2) NOT NULL,
  CONSTRAINT fk_loan_repayment_allocations_repayment FOREIGN KEY (loan_repayment_id) REFERENCES loan_repayments (id) ON DELETE CASCADE,
  CONSTRAINT fk_loan_repayment_allocations_schedule FOREIGN KEY (loan_schedule_id) REFERENCES loan_schedules (id) ON DELETE RESTRICT,
  KEY idx_loan_repayment_allocations_repayment (loan_repayment_id),
  KEY idx_loan_repayment_allocations_schedule (loan_schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS savings_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  account_number VARCHAR(30) NOT NULL,
  balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('active','closed') NOT NULL DEFAULT 'active',
  opened_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_savings_accounts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_savings_accounts_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_savings_accounts_tenant_number (tenant_id, account_number),
  KEY idx_savings_accounts_tenant (tenant_id),
  KEY idx_savings_accounts_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- balance_after is a real transaction-history column, not something derived
-- on read — savings_accounts.balance is the current total, this table is
-- the immutable ledger that produced it (deposits/withdrawals are never
-- allowed to just overwrite a single balance field with no trail).
CREATE TABLE IF NOT EXISTS savings_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  savings_account_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  type ENUM('deposit','withdrawal') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  reference VARCHAR(100) NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_savings_transactions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_savings_transactions_account FOREIGN KEY (savings_account_id) REFERENCES savings_accounts (id) ON DELETE RESTRICT,
  CONSTRAINT fk_savings_transactions_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
  KEY idx_savings_transactions_account (savings_account_id),
  KEY idx_savings_transactions_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  leader_customer_id BIGINT UNSIGNED NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_groups_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_loan_groups_leader FOREIGN KEY (leader_customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  KEY idx_loan_groups_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_group_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  loan_group_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_group_members_group FOREIGN KEY (loan_group_id) REFERENCES loan_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_loan_group_members_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
  UNIQUE KEY uq_loan_group_members_group_customer (loan_group_id, customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Notification categories — same additive ENUM-extension pattern
-- 025_extend_notifications_billing_categories.sql already established.
-- ============================================================
ALTER TABLE notifications
  MODIFY COLUMN category ENUM(
    'low_stock','purchase_completed','sale_completed','transfer_completed',
    'expense_submitted','expense_approved','return_processed','system_error',
    'trial_ending','subscription_expiring','subscription_expired',
    'invoice_generated','renewal_reminder','plan_changed',
    'loan_disbursed','loan_repayment_recorded'
  ) NOT NULL;

-- ============================================================
-- Module Registry — activate the two Phase 5 placeholders this build
-- actually implements, and register the three genuinely new modules.
-- ============================================================
UPDATE modules SET
  is_active = TRUE,
  route = '/loans',
  required_permission = 'loans.view',
  dashboard_widgets = '["totalBorrowers","activeLoans","totalDisbursed","totalCollected","outstandingBalance","overdueLoans","portfolioAtRisk","todayCollections"]',
  navigation_order = 7
WHERE `key` = 'loans';

UPDATE modules SET
  is_active = TRUE,
  route = '/savings',
  required_permission = 'savings.view',
  dashboard_widgets = '["totalSavingsBalance"]',
  navigation_order = 9
WHERE `key` = 'savings';

INSERT IGNORE INTO modules (id, `key`, name, icon, route, required_permission, navigation_order, is_core, is_active) VALUES
  (30, 'loan_products', 'Loan Products', 'FiLayers', '/loan-products', 'loan_products.view', 6, FALSE, TRUE),
  (31, 'loan_repayments', 'Repayments', 'FiCreditCard', '/repayments', 'loan_repayments.view', 8, FALSE, TRUE),
  (32, 'borrower_groups', 'Groups', 'FiUsers', '/groups', 'borrower_groups.view', 10, FALSE, TRUE);

-- template_modules rows for Microfinance (business_template_id=11) already
-- exist for module_id 22 (loans) and 23 (savings) — seeded by
-- 026_create_module_framework_tables.sql, is_enabled=TRUE, inert until now
-- because modules.is_active was FALSE. Flipping is_active above (not a
-- template_modules change) is what actually lights them up — only the 3
-- brand-new module ids need a new template_modules row.
INSERT IGNORE INTO template_modules (business_template_id, module_id, is_enabled) VALUES
  (11, 30, TRUE), -- Microfinance: Loan Products
  (11, 31, TRUE), -- Microfinance: Repayments
  (11, 32, TRUE); -- Microfinance: Groups

-- ============================================================
-- Permissions — same catalog role_permissions.js/authorize.js already
-- enforce, nothing new invented.
-- ============================================================
INSERT IGNORE INTO permissions (code, module, action, description) VALUES
  ('loan_products.view', 'loan_products', 'view', 'View loan products'),
  ('loan_products.manage', 'loan_products', 'manage', 'Create, edit and deactivate loan products'),
  ('loans.view', 'loans', 'view', 'View loan applications and accounts'),
  ('loans.create', 'loans', 'create', 'Create loan applications'),
  ('loans.approve', 'loans', 'approve', 'Approve or reject loan applications'),
  ('loans.disburse', 'loans', 'disburse', 'Disburse approved loans'),
  ('loans.manage', 'loans', 'manage', 'Edit loans, manage guarantors, write off loans'),
  ('loan_repayments.view', 'loan_repayments', 'view', 'View loan repayments'),
  ('loan_repayments.create', 'loan_repayments', 'create', 'Record loan repayments'),
  ('savings.view', 'savings', 'view', 'View savings accounts and transactions'),
  ('savings.manage', 'savings', 'manage', 'Open savings accounts, record deposits and withdrawals'),
  ('borrower_groups.view', 'borrower_groups', 'view', 'View borrower groups'),
  ('borrower_groups.manage', 'borrower_groups', 'manage', 'Create and manage borrower groups');

-- Super Administrator only — mirrors 001_seed_roles_permissions.sql's own
-- convention of granting new areas to the system role every tenant's
-- self-registered owner holds, never to the retail-flavored Manager/
-- Cashier/Store Keeper roles (those stay exactly as they were; a
-- Microfinance tenant's owner creates their own custom roles for loan
-- officers via the existing roles.create feature, same as any tenant does today).
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'loan_products.view','loan_products.manage',
  'loans.view','loans.create','loans.approve','loans.disburse','loans.manage',
  'loan_repayments.view','loan_repayments.create',
  'savings.view','savings.manage',
  'borrower_groups.view','borrower_groups.manage'
) WHERE r.name = 'Super Administrator';
