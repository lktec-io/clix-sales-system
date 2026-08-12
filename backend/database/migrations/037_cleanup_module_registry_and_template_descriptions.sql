-- 037_cleanup_module_registry_and_template_descriptions.sql
-- Platform Admin polish — cleans up two sources of clutter surfaced by
-- actually using the Module Registry and Business Templates admin pages:
--
-- 1. Eight module rows that will NEVER be built are removed outright, not
--    just left inactive:
--      - students(17), teachers(18), attendance(25), fees(26) — belonged
--        only to School (archived permanently — 034_finalize_template_
--        scope_and_electronics_repairs.sql, no application code was ever
--        built for it, confirmed by full-repo audit).
--      - members(24) — belonged only to School/SACCOS-era Microfinance;
--        the finalized Microfinance scope explicitly excludes a separate
--        "Members" concept (customers already cover this — see the
--        earlier Microfinance-simplification phase's own "do not
--        reintroduce Groups/Guarantors/unnecessary complexity").
--      - payroll(27), hr(28), accounting(29) — generic "someday" seed
--        placeholders never mapped to any template, live or archived, by
--        any migration since.
--    All eight are already is_active=FALSE (never surfaced to any
--    tenant) — this migration only removes stale registry-admin clutter,
--    it changes zero tenant-facing behavior. template_modules rows that
--    reference them cascade-delete automatically (fk_template_modules_
--    module ... ON DELETE CASCADE), all of which belong to already-
--    archived School/SACCOS anyway.
--
--    Explicitly NOT touched: savings(23) and borrower_groups(32) — both
--    is_active=TRUE, fully built (routes, repositories, frontend pages
--    already exist), and only disabled for Microfinance by deliberate
--    product-scope choice (029_simplify_microfinance_modules.sql). That's
--    working infrastructure switched off on purpose, not dead weight —
--    left alone per the standing "do not delete useful backend
--    infrastructure" instruction.
--
-- 2. Removes the stale "(Phase 6+)" qualifier from business_templates
--    .description for the three templates that text used to correctly
--    describe as not-yet-built and are now fully built: Pharmacy,
--    Restaurant, Microfinance. Also tidies School/SACCOS's copy while
--    here, even though they're archived (an admin viewing "all statuses"
--    should never read a promise about a feature that will never ship).

DELETE FROM modules WHERE id IN (17, 18, 24, 25, 26, 27, 28, 29);

UPDATE business_templates SET
  description = 'Retail pharmacy — medicines, batch and expiry tracking, and point-of-sale.'
WHERE slug = 'pharmacy';

UPDATE business_templates SET
  description = 'Food service — menu, tables, order management, and a live kitchen queue.'
WHERE slug = 'restaurant';

UPDATE business_templates SET
  description = 'Microfinance lending — loan products, applications, and repayment tracking, kept simple.'
WHERE slug = 'microfinance';

UPDATE business_templates SET
  description = 'Educational institution.'
WHERE slug = 'school';

UPDATE business_templates SET
  description = 'Savings and Credit Cooperative.'
WHERE slug = 'saccos';
