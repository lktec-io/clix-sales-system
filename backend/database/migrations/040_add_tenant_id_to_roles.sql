-- 040_add_tenant_id_to_roles.sql
-- SECURITY FIX: `roles` had zero tenant isolation despite role.service.js
-- exposing full tenant-facing CRUD (create/update/delete/setPermissions)
-- on top of it. GET /roles returned every tenant's roles to any
-- authenticated user (no filter anywhere in role.repository.js), and any
-- user holding roles.edit/roles.delete/roles.manage could mutate,
-- delete, or reassign the permission set of ANOTHER tenant's custom role
-- by guessing its numeric id — a full breakdown of tenant isolation for
-- the custom-role feature.
--
-- The 4 seeded system roles (Super Administrator/Manager/Cashier/Store
-- Keeper) are intentionally global/shared across every tenant — this fix
-- leaves them at tenant_id = NULL, unchanged in behavior, and only scopes
-- tenant-CREATED custom roles (is_system = FALSE) to their owning tenant.

ALTER TABLE roles
  ADD COLUMN tenant_id BIGINT UNSIGNED NULL AFTER id,
  ADD KEY idx_roles_tenant (tenant_id),
  ADD CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE;

-- Replaces the old global `uq_roles_name(name)` — a name unique per
-- tenant, not across every tenant, is the correct scope for a custom
-- role. MySQL unique indexes treat every NULL as a distinct value, so the
-- 4 seeded system rows (tenant_id NULL) are unaffected by this change.
ALTER TABLE roles DROP INDEX uq_roles_name;
ALTER TABLE roles ADD UNIQUE KEY uq_roles_tenant_name (tenant_id, name);
