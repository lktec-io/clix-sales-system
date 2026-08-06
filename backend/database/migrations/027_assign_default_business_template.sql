-- 027_assign_default_business_template.sql
-- Phase 5 — Business Templates & Dynamic Module Framework.
--
-- Purely additive, metadata-only column add, same idiom
-- 018_add_tenant_id_to_business_tables.sql already established:
-- `DEFAULT 1` backfills every existing tenant row to Retail Store (id=1,
-- seeded deterministically in 026_create_module_framework_tables.sql)
-- instantly — no manual UPDATE needed, no existing tenant loses
-- functionality (Step 14). Every new self-registration also lands on
-- Retail Store by default via businessTemplateAssignment.service.js,
-- called additively from tenant.controller.js (tenant.service.js and
-- tenant.repository.js are not touched).
ALTER TABLE tenants
  ADD COLUMN business_template_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER subscription_status,
  ADD CONSTRAINT fk_tenants_business_template FOREIGN KEY (business_template_id) REFERENCES business_templates (id) ON DELETE RESTRICT,
  ADD KEY idx_tenants_business_template (business_template_id);
