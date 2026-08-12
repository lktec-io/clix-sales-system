-- 038_add_repair_estimated_cost.sql
-- Electronics/Repairs UX pass. The intake form could already record every
-- other field the "Receive Device" step needs (customer, device details,
-- condition, accessories, reported problem, expected completion date) but
-- had no way to capture a pre-diagnosis ballpark cost — repair_total is
-- only ever computed AFTER parts/labor are recorded during actual repair,
-- which is too late for a technician to give the customer any estimate at
-- intake. A deposit at intake needs no new column — it already reuses the
-- existing repair_payments/amount_paid mechanism (repair.service.js's
-- recordPayment() already supports any non-terminal status, including
-- 'received').

ALTER TABLE repairs
  ADD COLUMN estimated_cost DECIMAL(15,2) NULL AFTER reported_problem;
