-- 002_seed_reference_data.sql
-- Static reference data explicitly enumerated in MASTER_PROMPT.md. Safe: no
-- secrets, no user accounts. Idempotent: safe to re-run.

INSERT IGNORE INTO expense_categories (name) VALUES
  ('Rent'), ('Electricity'), ('Water'), ('Fuel'), ('Salary'),
  ('Maintenance'), ('Transport'), ('Office Supplies'), ('Other');
