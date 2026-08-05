const CYCLE_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };

// Calendar-correct month add, clamping day-of-month overflow (Jan 31 +1
// month -> Feb 28/29, never Mar 3) — used for every renewal/scheduled-change
// date in the billing engine, so "renew a Jan 31 subscription monthly"
// never drifts across months over repeated renewals.
export function addBillingCycle(date, cycle) {
  const months = CYCLE_MONTHS[cycle];
  if (!months) throw new Error(`addBillingCycle() received an unknown cycle: ${cycle}`);

  const source = new Date(date);
  const targetMonthIndex = source.getMonth() + months;
  const daysInTargetMonth = new Date(source.getFullYear(), targetMonthIndex + 1, 0).getDate();

  const result = new Date(source.getFullYear(), targetMonthIndex, Math.min(source.getDate(), daysInTargetMonth));
  result.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return result;
}

// Same computation, two names — "Renewal Date" and "Next Billing Date"
// (Step 8) are the same value (the subscription's new end_date once it
// renews), viewed from two different parts of the UI. Aliasing rather than
// duplicating the calculation satisfies both vocabularies without a second
// implementation to keep in sync.
export const computeRenewalDate = addBillingCycle;
export const computeNextBillingDate = addBillingCycle;

export function computeGracePeriodEnd(endDate, graceDays) {
  const result = new Date(endDate);
  result.setDate(result.getDate() + graceDays);
  return result;
}

export function priceForCycle(plan, cycle) {
  const column = { monthly: 'price_monthly', quarterly: 'price_quarterly', yearly: 'price_yearly' }[cycle];
  if (!column) throw new Error(`priceForCycle() received an unknown cycle: ${cycle}`);
  return Number(plan[column]) || 0;
}

// Normalizes any cycle's price to its monthly-equivalent value — the
// building block both the "Monthly Revenue (Projected)" and "Annual Revenue
// Projection" dashboard widgets sum over active subscriptions (one query,
// one CASE-based SUM in tenantSubscription.repository.js — this helper only
// documents the divisor, the SQL does the actual summing).
export function monthlyEquivalent(plan, cycle) {
  const divisor = { monthly: 1, quarterly: 3, yearly: 12 }[cycle];
  if (!divisor) throw new Error(`monthlyEquivalent() received an unknown cycle: ${cycle}`);
  return priceForCycle(plan, cycle) / divisor;
}
