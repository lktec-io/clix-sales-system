-- 029_simplify_microfinance_modules.sql
-- Microfinance simplification pass — the Microfinance template (id 11)
-- must resolve to a focused Loan Management System (Dashboard, Customers,
-- Loan Products, Loans, Repayments, Reports, Settings), not a
-- general-purpose ERP. Savings and Groups were enabled for Microfinance in
-- 026/028 but are being removed from that template's experience here.
--
-- Deliberately NOT touching the `modules` table (Savings/Groups stay
-- is_active = TRUE globally) and NOT dropping the savings_accounts/
-- savings_transactions/loan_groups/loan_group_members tables — those are
-- real, working, tenant-isolated code that may still serve a future SACCOS
-- template (Priority 5), and dropping tables here would be exactly the
-- "destroy existing production data" this migration is told not to do.
-- This only changes which modules the MICROFINANCE TEMPLATE resolves to —
-- template_modules.is_enabled flips to FALSE, the row is never deleted,
-- matching 026's own "toggle, never insert/delete" convention.

UPDATE template_modules
SET is_enabled = FALSE
WHERE business_template_id = 11 AND module_id IN (
  15, -- expenses — not part of the lending-only surface requested; other
      -- templates (Retail, Pharmacy, ...) keep it untouched
  23, -- savings
  32  -- borrower_groups
);

-- Dashboard widget set — replaces the original 8-key list with exactly the
-- 6 metrics requested (Total Active Loans, Total Disbursed, Total
-- Collected, Outstanding Balance, Overdue Loans, Overdue Amount, Pending
-- Applications), dropping totalBorrowers/todayCollections (not on the
-- requested list) and adding pendingApplications (a new metric — see
-- loan.repository.js#getPortfolioSummary()'s companion backend change).
UPDATE modules
SET dashboard_widgets = '["activeLoans","totalDisbursed","totalCollected","outstandingBalance","overdueLoans","portfolioAtRisk","pendingApplications"]'
WHERE `key` = 'loans';
