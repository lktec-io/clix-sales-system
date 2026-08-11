-- 032_reassert_pharmacy_template_active.sql
--
-- Root-cause context: business_templates itself is fully correct at the
-- source — 026_create_module_framework_tables.sql seeds all 12 templates
-- (including id=8 'Pharmacy', slug='pharmacy') in one INSERT with
-- status='active', and businessTemplate.service.js#listPublicTemplates()
-- simply does `SELECT * FROM business_templates WHERE status = 'active'`
-- with no pagination/limit/hardcoded list to exclude anything. That whole
-- chain was re-read line by line and is not where this bug lives.
--
-- Since this project's migrations are applied by hand, one .sql file at a
-- time, with no tracking table (see database/README.md) and no way for this
-- session to query the live database, there are exactly two ways Pharmacy's
-- signup card can be missing while every other template shows fine:
--   (a) 026 was applied on this database before the Pharmacy row existed in
--       an earlier draft, and a later re-run of 026 silently no-opped on it
--       (INSERT IGNORE skips on a PRIMARY KEY/UNIQUE KEY collision), leaving
--       whatever partial/wrong row was already there, OR
--   (b) the Pharmacy row's `status` was flipped away from 'active' via the
--       Platform Admin Templates page (TemplateList.jsx's real Activate/
--       Deactivate/Archive actions, businessTemplate.service.js#deactivate
--       Template/#archiveTemplate) at some point.
-- Both are live-data problems, not code problems — this migration is a safe,
-- idempotent re-assertion that fixes either cause without guessing which one
-- it was and without touching any other template's status (Restaurant/
-- School/SACCOS are intentionally left as-is; their sparse-but-active seed
-- state is by design per 026's own plan, not a bug to "fix" here).

-- Covers cause (a): re-create the canonical row only if it is missing
-- entirely. No-op if it already exists, under any status — this never
-- overwrites an existing row's id/name/description, only fills a gap.
INSERT IGNORE INTO business_templates (id, name, slug, description, status) VALUES
  (8, 'Pharmacy', 'pharmacy', 'Retail pharmacy — Medicines and Expiry tracking activate once built (Phase 6+).', 'active');

-- Covers cause (b): whatever the row's current status is, force it back to
-- 'active'. Scoped by slug (not id) so this is correct even if the row's id
-- ever drifted from the deterministic seed value. Touches nothing else on
-- the row (name/description are left as whatever an admin may have already
-- customized via Rename).
UPDATE business_templates SET status = 'active' WHERE slug = 'pharmacy';
