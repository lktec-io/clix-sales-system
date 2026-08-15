-- 041_add_medicine_barcode.sql
-- Pharmacy POS rebuild needs "search medicine by name or barcode" and the
-- simplified Medicine creation form needs an optional Barcode field —
-- neither is representable today: `medicines` has no barcode/code column
-- at all (unlike `products.code`, which already doubles as Retail's
-- barcode). Nullable and unique only when present (MySQL unique indexes
-- treat every NULL as distinct), scoped per tenant so two tenants can
-- legitimately stock the same manufacturer barcode.
ALTER TABLE medicines ADD COLUMN barcode VARCHAR(64) NULL AFTER name;
ALTER TABLE medicines ADD UNIQUE KEY uq_medicines_tenant_barcode (tenant_id, barcode);
