-- 045_update_final_commercial_pricing.sql
-- Final production pricing — replaces the illustrative Starter/Business/
-- Enterprise seed from 024_create_billing_tables.sql (that migration's own
-- comment already called those prices "illustrative and immediately
-- editable"). Updates the SAME 3 deterministic rows (id 1/2/3) in place —
-- every tenant_subscriptions/subscription_events/invoices row already
-- referencing plan_id 1/2/3 stays correctly linked, no data migration
-- needed beyond the plan rows themselves. This is the one and only place
-- plan price/name data lives; the frontend (Landing pricing section,
-- Register, BillingOverview, platform PlanList) all read from
-- subscription_plans via the API — nothing hardcodes a second copy.
--
-- Quarterly/yearly figures keep the exact discount pattern the original
-- seed already established (yearly = monthly x10, i.e. "2 months free";
-- quarterly = monthly x3 less ~10%), applied to the new base prices — not
-- a new discount policy invented for this migration.
UPDATE subscription_plans SET
  name = 'Basic', slug = 'basic',
  description = 'For small businesses getting started.',
  price_monthly = 15000, price_quarterly = 40000, price_yearly = 150000,
  is_recommended = FALSE, sort_order = 1
WHERE id = 1;

UPDATE subscription_plans SET
  name = 'Premium', slug = 'premium',
  description = 'For growing businesses that need more control and automation.',
  price_monthly = 30000, price_quarterly = 80000, price_yearly = 300000,
  is_recommended = TRUE, sort_order = 2
WHERE id = 2;

UPDATE subscription_plans SET
  name = 'Premium Plus', slug = 'premium-plus',
  description = 'For businesses that need the full power of the platform.',
  price_monthly = 50000, price_quarterly = 135000, price_yearly = 500000,
  is_recommended = FALSE, sort_order = 3
WHERE id = 3;
