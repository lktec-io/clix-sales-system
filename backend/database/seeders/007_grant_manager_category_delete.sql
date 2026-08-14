-- 007_grant_manager_category_delete.sql
-- The Manager role already had categories.view/create/edit
-- (001_seed_roles_permissions.sql) but not categories.delete, so the new
-- category-delete UI (Part 2 of the Pharmacy/Category/Error-UX phase) would
-- be reachable only by Super Administrator — the exact "inconsistent"
-- category management the product owner flagged. Manager already holds the
-- equivalent delete-level permission on the sibling catalog concept it
-- manages (products.manage covers delete). Idempotent: safe to re-run.

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'categories.delete'
WHERE r.name = 'Manager' AND r.tenant_id IS NULL;
