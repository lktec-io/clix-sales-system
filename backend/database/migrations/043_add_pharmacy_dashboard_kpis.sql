-- 043_add_pharmacy_dashboard_kpis.sql
-- Pharmacy Simplification & Production UX Rebuild — Dashboard KPI additions.
-- Adds two new Pharmacy dashboard cards: "Medicines Sold" (total units
-- dispensed today, across all completed pharmacy_sales) and "Today's Profit"
-- (today's dispensed revenue minus the actual cost of goods sold, using the
-- exact batch each line was dispensed from). Both are computed in
-- pharmacySale.repository.js#getSalesSummary() alongside the existing
-- todaySalesCount/todayRevenue widgets, so they only need registering here
-- as new dashboard_widgets keys — no new columns, no new tables.
--
-- Purely additive to the JSON array 031_create_pharmacy_tables.sql set for
-- the `medicines` module (never edit an already-applied migration) — the
-- exact same 7 keys, plus "medicinesSoldCount" and "todayProfit" appended.
UPDATE modules SET
  dashboard_widgets = '["totalMedicines","lowStockCount","outOfStockCount","expiredCount","expiringSoonCount","todaySalesCount","todayRevenue","medicinesSoldCount","todayProfit"]'
WHERE `key` = 'medicines';
