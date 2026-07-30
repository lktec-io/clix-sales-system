-- 013_make_product_brand_optional.sql
-- Sales Management System UI/UX refactor sprint: the Products form now
-- treats Brand as optional (not every product a retailer sells has a
-- meaningful brand) — relaxes the column
-- from NOT NULL to nullable. Non-destructive: every existing product keeps
-- its current brand_id value unchanged; this only allows new/edited rows
-- to store NULL going forward. The FK (fk_products_brand, ON DELETE
-- RESTRICT) is preserved as-is — MySQL foreign keys never apply to NULL
-- values, so this doesn't loosen referential integrity for rows that do
-- have a brand.

ALTER TABLE products MODIFY COLUMN brand_id BIGINT UNSIGNED NULL;
