-- 042_reorder_pharmacy_sidebar.sql
-- Pharmacy Simplification & Production UX Rebuild — sidebar order polish.
-- Product spec wants Pharmacy's nav ordered Dashboard, Sales, Medicines,
-- Purchases, Suppliers, Customers, Expenses, Reports (Sales-first since
-- dispensing is the daily task; Customers moved down since pharmacy retail
-- is walk-in-first, unlike e.g. Microfinance). Today's actual order
-- (Dashboard, Customers, Medicines, Sales, Purchases, Expiry, Suppliers,
-- Expenses, Reports — see 031_create_pharmacy_tables.sql's navigation_order
-- values) is driven entirely by `modules.navigation_order`, a GLOBAL column
-- shared by every template that reuses Customers(13)/Suppliers(14)/
-- Expenses(15)/Reports(16), so it can't be edited directly without also
-- reordering those modules for Retail/Wholesale/Hardware/Electronics/
-- Clothing/Cosmetics/Restaurant.
--
-- template_modules.sort_order_override (added in 026, per-template) is the
-- correct lever for exactly this — it existed in the schema already but had
-- never been wired into the resolver's ordering logic
-- (moduleResolution.service.js) until this same change; see that file for
-- the resolver update this migration's data depends on. Setting an override
-- ONLY for business_template_id = 8 (Pharmacy) reorders Pharmacy's sidebar
-- without touching a single other template's rows or its resolved order —
-- every other template's template_modules.sort_order_override stays NULL,
-- so those tenants keep using modules.navigation_order exactly as before.
--
-- Expiry Tracking isn't called out in the product spec's order — it keeps
-- its existing logical spot right after Purchases (stock you just received
-- is exactly what you'd check expiry on next), before Suppliers.
UPDATE template_modules SET sort_order_override = 2 WHERE business_template_id = 8 AND module_id = 33; -- Sales
UPDATE template_modules SET sort_order_override = 3 WHERE business_template_id = 8 AND module_id = 19; -- Medicines
UPDATE template_modules SET sort_order_override = 4 WHERE business_template_id = 8 AND module_id = 34; -- Purchases
UPDATE template_modules SET sort_order_override = 5 WHERE business_template_id = 8 AND module_id = 20; -- Expiry Tracking
UPDATE template_modules SET sort_order_override = 6 WHERE business_template_id = 8 AND module_id = 14; -- Suppliers
UPDATE template_modules SET sort_order_override = 7 WHERE business_template_id = 8 AND module_id = 13; -- Customers
UPDATE template_modules SET sort_order_override = 8 WHERE business_template_id = 8 AND module_id = 15; -- Expenses
UPDATE template_modules SET sort_order_override = 9 WHERE business_template_id = 8 AND module_id = 16; -- Reports
