-- 004_fix_role_permissions.sql
-- Authoritative reset of the 4 supported system roles' permission sets.
-- Supersedes 003_seed_role_updates.sql's "Cashier -> Sales" rename (reverted
-- here per updated spec: the role stays "Cashier") and fully replaces each
-- system role's role_permissions instead of only adding to them, so this
-- also corrects any drift from manual edits (e.g. via the now-removed
-- Permission Matrix page) or a role that ended up with zero permissions
-- assigned — including dashboard.view, whose absence is what caused
-- dashboard.view-gated endpoints to 403 for otherwise-legitimate users.
-- Idempotent: every block below is a full delete-then-insert for a named
-- role, safe to re-run.

UPDATE roles
SET name = 'Cashier', description = 'Point of sale operations for their assigned branch'
WHERE name = 'Sales';

-- Super Administrator: every permission, unconditionally.
DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.name = 'Super Administrator';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'Super Administrator';

-- Manager: all operational modules, no system administration
-- (branches/users/roles/company/settings creation or management).
DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.name = 'Manager';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard.view', 'branches.view',
  'categories.view', 'categories.create', 'categories.edit',
  'brands.view', 'brands.create', 'brands.edit',
  'products.view', 'products.create', 'products.edit', 'products.manage', 'products.export', 'products.print',
  'inventory.view', 'inventory.approve',
  'suppliers.view', 'suppliers.create', 'suppliers.edit',
  'purchases.view', 'purchases.create', 'purchases.manage',
  'transfers.view', 'transfers.create', 'transfers.approve',
  'customers.view', 'customers.create', 'customers.edit',
  'sales.view', 'sales.create', 'sales.manage',
  'returns.view', 'returns.create', 'returns.approve',
  'expenses.view', 'expenses.create', 'expenses.edit',
  'reports.view', 'reports.export'
) WHERE r.name = 'Manager';

-- Cashier: narrowed to exactly Dashboard, Customers, Sales — matching the
-- explicit sidebar spec (Dashboard / Customers / Sales / Profile / Logout,
-- nothing else). Deliberately dropped from the original broader seed:
-- products/inventory/suppliers/purchases/transfers/returns/expenses/
-- reports view access.
DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.name = 'Cashier';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard.view',
  'customers.view', 'customers.create',
  'sales.view', 'sales.create'
) WHERE r.name = 'Cashier';

-- Store Keeper: unchanged from the original seed.
DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.name = 'Store Keeper';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
  'dashboard.view',
  'products.view',
  'inventory.view', 'inventory.adjust',
  'suppliers.view',
  'purchases.view', 'purchases.create',
  'transfers.view', 'transfers.create',
  'sales.view',
  'returns.view',
  'reports.view'
) WHERE r.name = 'Store Keeper';
