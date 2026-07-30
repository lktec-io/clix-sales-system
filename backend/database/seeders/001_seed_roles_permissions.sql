-- 001_seed_roles_permissions.sql
-- Safe, static reference data: the 4 system roles and the permission catalog.
-- No user accounts or secrets are seeded here (see backend/database/seeders/README.md).
-- Idempotent: safe to re-run.

INSERT IGNORE INTO roles (name, description, is_system) VALUES
  ('Super Administrator', 'Full system access across all branches', TRUE),
  ('Manager', 'Manages assigned branch(es): catalog, inventory, sales, purchases, transfers, expenses, reports', TRUE),
  ('Cashier', 'Point of sale operations for their assigned branch', TRUE),
  ('Store Keeper', 'Inventory, purchases and stock transfers for their assigned branch', TRUE);

INSERT IGNORE INTO permissions (code, module, action, description) VALUES
  ('dashboard.view', 'dashboard', 'view', 'View dashboard KPIs, charts and activity'),

  ('branches.view', 'branches', 'view', 'View branches'),
  ('branches.create', 'branches', 'create', 'Create branches'),
  ('branches.edit', 'branches', 'edit', 'Edit branches'),

  ('users.view', 'users', 'view', 'View users'),
  ('users.create', 'users', 'create', 'Create users'),
  ('users.edit', 'users', 'edit', 'Edit users'),
  ('users.delete', 'users', 'delete', 'Deactivate/delete users'),
  ('users.manage', 'users', 'manage', 'Assign roles and branches to users'),

  ('roles.view', 'roles', 'view', 'View roles and permissions'),
  ('roles.create', 'roles', 'create', 'Create custom roles'),
  ('roles.edit', 'roles', 'edit', 'Edit roles'),
  ('roles.delete', 'roles', 'delete', 'Delete custom roles'),
  ('roles.manage', 'roles', 'manage', 'Assign permissions to roles'),

  ('company.manage', 'company', 'manage', 'Edit company profile and logo'),
  ('settings.view', 'settings', 'view', 'View system settings'),
  ('settings.manage', 'settings', 'manage', 'Edit system settings and trigger backups'),

  ('categories.view', 'categories', 'view', 'View categories'),
  ('categories.create', 'categories', 'create', 'Create categories'),
  ('categories.edit', 'categories', 'edit', 'Edit categories'),
  ('categories.delete', 'categories', 'delete', 'Delete categories'),

  ('brands.view', 'brands', 'view', 'View brands'),
  ('brands.create', 'brands', 'create', 'Create brands'),
  ('brands.edit', 'brands', 'edit', 'Edit brands'),
  ('brands.delete', 'brands', 'delete', 'Delete brands'),

  ('products.view', 'products', 'view', 'View products'),
  ('products.create', 'products', 'create', 'Create products'),
  ('products.edit', 'products', 'edit', 'Edit products'),
  ('products.delete', 'products', 'delete', 'Deactivate/delete products'),
  ('products.manage', 'products', 'manage', 'Bulk actions, QR regeneration'),
  ('products.export', 'products', 'export', 'Export product data'),
  ('products.print', 'products', 'print', 'Print product labels'),

  ('inventory.view', 'inventory', 'view', 'View inventory and stock movements'),
  ('inventory.adjust', 'inventory', 'adjust', 'Create stock adjustments'),
  ('inventory.approve', 'inventory', 'approve', 'Approve stock adjustments'),

  ('suppliers.view', 'suppliers', 'view', 'View suppliers'),
  ('suppliers.create', 'suppliers', 'create', 'Create suppliers'),
  ('suppliers.edit', 'suppliers', 'edit', 'Edit suppliers'),

  ('purchases.view', 'purchases', 'view', 'View purchases'),
  ('purchases.create', 'purchases', 'create', 'Create purchases'),
  ('purchases.manage', 'purchases', 'manage', 'Record supplier payments'),

  ('transfers.view', 'transfers', 'view', 'View stock transfers'),
  ('transfers.create', 'transfers', 'create', 'Create stock transfer requests'),
  ('transfers.approve', 'transfers', 'approve', 'Approve or reject stock transfers'),

  ('customers.view', 'customers', 'view', 'View customers'),
  ('customers.create', 'customers', 'create', 'Create customers'),
  ('customers.edit', 'customers', 'edit', 'Edit customers'),

  ('sales.view', 'sales', 'view', 'View sales'),
  ('sales.create', 'sales', 'create', 'Create sales (POS checkout)'),
  ('sales.manage', 'sales', 'manage', 'Void sales, override discount limits'),

  ('returns.view', 'returns', 'view', 'View returns'),
  ('returns.create', 'returns', 'create', 'Create return requests'),
  ('returns.approve', 'returns', 'approve', 'Approve or reject returns'),

  ('expenses.view', 'expenses', 'view', 'View expenses'),
  ('expenses.create', 'expenses', 'create', 'Create expenses'),
  ('expenses.edit', 'expenses', 'edit', 'Edit expenses'),
  ('expenses.delete', 'expenses', 'delete', 'Delete expenses'),

  ('reports.view', 'reports', 'view', 'View reports'),
  ('reports.export', 'reports', 'export', 'Export reports to PDF/Excel/CSV');

-- Super Administrator: every permission.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'Super Administrator';

-- Manager: catalog, inventory oversight, sales, purchases, transfers, expenses, reports.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard.view', 'branches.view',
  'categories.view','categories.create','categories.edit',
  'brands.view','brands.create','brands.edit',
  'products.view','products.create','products.edit','products.manage','products.export','products.print',
  'inventory.view','inventory.approve',
  'suppliers.view','suppliers.create','suppliers.edit',
  'purchases.view','purchases.create','purchases.manage',
  'transfers.view','transfers.create','transfers.approve',
  'customers.view','customers.create','customers.edit',
  'sales.view','sales.create','sales.manage',
  'returns.view','returns.create','returns.approve',
  'expenses.view','expenses.create','expenses.edit',
  'reports.view','reports.export'
) WHERE r.name = 'Manager';

-- Cashier: POS-facing operations for their assigned branch.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard.view',
  'products.view',
  'inventory.view',
  'suppliers.view',
  'purchases.view',
  'transfers.view',
  'customers.view','customers.create',
  'sales.view','sales.create',
  'returns.view','returns.create',
  'expenses.view',
  'reports.view'
) WHERE r.name = 'Cashier';

-- Store Keeper: inventory, purchases and transfers for their assigned branch.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard.view',
  'products.view',
  'inventory.view','inventory.adjust',
  'suppliers.view',
  'purchases.view','purchases.create',
  'transfers.view','transfers.create',
  'sales.view',
  'returns.view',
  'reports.view'
) WHERE r.name = 'Store Keeper';
