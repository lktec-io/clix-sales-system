-- 025_extend_notifications_billing_categories.sql
-- Phase 4 — Premium SaaS Billing Engine. Adds 6 new category values to the
-- existing tenant-facing `notifications` table so the billing lifecycle
-- (subscriptionLifecycle.service.js, subscriptionLifecycleJob.js) can fan
-- out notifications through the SAME table/helper (notifyBranchManagement)
-- every other tenant-facing notification already uses — no new
-- notifications table, no new fan-out mechanism.
--
-- Purely additive: all 8 existing category values are preserved verbatim,
-- in their original order, with 6 new ones appended. Existing rows and
-- existing code paths (low_stock, purchase_completed, etc.) are unaffected.

ALTER TABLE notifications
  MODIFY COLUMN category ENUM(
    'low_stock','purchase_completed','sale_completed','transfer_completed',
    'expense_submitted','expense_approved','return_processed','system_error',
    'trial_ending','subscription_expiring','subscription_expired',
    'invoice_generated','renewal_reminder','plan_changed'
  ) NOT NULL;
