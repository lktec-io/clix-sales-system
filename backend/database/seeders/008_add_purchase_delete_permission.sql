-- 008_add_purchase_delete_permission.sql
-- New permission for the hard-delete-a-purchase feature — 'purchases.manage'
-- already existed but is scoped to "record supplier payments"
-- (001_seed_roles_permissions.sql:63), a distinct action from permanently
-- removing the order itself. Granted to Super Administrator (automatic,
-- cross-join) and Manager, matching the same two roles
-- 006_add_customer_supplier_delete_permissions.sql granted customers.delete/
-- suppliers.delete to. Idempotent: safe to re-run.

INSERT IGNORE INTO permissions (code, module, action, description) VALUES
  ('purchases.delete', 'purchases', 'delete', 'Permanently delete purchases');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'purchases.delete'
WHERE r.name IN ('Super Administrator', 'Manager') AND r.tenant_id IS NULL;
