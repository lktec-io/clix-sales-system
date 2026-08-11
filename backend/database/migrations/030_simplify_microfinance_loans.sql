-- 030_simplify_microfinance_loans.sql
-- Second Microfinance simplification pass:
--
-- 1. Expenses is back in scope for Microfinance (029 removed it, this
--    corrects course per updated product direction — Microfinance keeps a
--    simple expense-recording feature, it just isn't a full accounting
--    module).
-- 2. Loan Products drops out of the day-to-day Microfinance workflow — the
--    simplified "Create Loan" form captures amount/rate/duration directly
--    on the loan itself (loans already snapshots these as its own columns;
--    see loan.service.js), rather than requiring the user to first define
--    and pick a Loan Product. The loan_products table/module/UI are NOT
--    deleted (a future SACCOS template, or an admin who wants standardized
--    products, can still use them) — Microfinance's template_modules
--    mapping simply stops requiring one.
-- 3. loans.loan_product_id becomes nullable so a loan can be created with
--    directly-entered terms and no product at all — the FK stays in place
--    for when a product IS supplied.

UPDATE template_modules SET is_enabled = TRUE WHERE business_template_id = 11 AND module_id = 15; -- expenses
UPDATE template_modules SET is_enabled = FALSE WHERE business_template_id = 11 AND module_id = 30; -- loan_products

ALTER TABLE loans MODIFY COLUMN loan_product_id BIGINT UNSIGNED NULL;

-- Purely informational — when the borrower/officer wants the loan to
-- start, captured at application time. Does NOT drive schedule generation
-- (disburseLoan() still generates the real schedule from the actual
-- disbursement moment, exactly as before) — this is a display-only field
-- on the application, not a second source of truth for loan timing.
ALTER TABLE loans ADD COLUMN requested_start_date DATE NULL AFTER purpose;

-- Dashboard widget set — the exact 8 metrics the simplified lending
-- dashboard shows: Total Loans (all-time count, any status), Active Loans,
-- Amount Disbursed, Amount Collected, Outstanding Balance, Overdue Loans,
-- Overdue Amount, Today's Collections.
UPDATE modules
SET dashboard_widgets = '["totalLoans","activeLoans","totalDisbursed","totalCollected","outstandingBalance","overdueLoans","portfolioAtRisk","todayCollections"]'
WHERE `key` = 'loans';
