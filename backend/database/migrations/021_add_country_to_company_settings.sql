-- 021_add_country_to_company_settings.sql
-- Phase 2 — Self-Service Tenant Registration & Trial Provisioning.
-- The registration form's optional "Country" field needs a real column —
-- company_settings.region already means something narrower (an
-- administrative region within the country, e.g. for Tanzania) and reusing
-- it would misfile the data. One small nullable column, no default.

ALTER TABLE company_settings
  ADD COLUMN country VARCHAR(100) NULL AFTER district;
