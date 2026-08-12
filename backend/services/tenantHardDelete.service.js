import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

// ============================================================================
// TRUE, PERMANENT tenant deletion — genuinely destroys every row this
// tenant owns, across every table in the schema. This is NOT the same as
// platformTenant.service.js#deleteTenant() (the existing soft-delete,
// which flips tenants.status to 'deleted' and keeps all data). That
// remains the default, reversible action; this is a separate, explicit,
// irreversible one, only for cleaning up test/trial tenants.
//
// Built by reading every CREATE TABLE/ALTER TABLE statement across
// migrations 001-037 to build a complete tenant_id ownership map, then
// ordering deletes child-before-parent so every ON DELETE RESTRICT
// constraint (the vast majority of this schema's tenant_id FKs) is
// satisfied at the moment each DELETE runs, rather than relying on
// SET FOREIGN_KEY_CHECKS=0 — disabling FK checks would silently succeed
// even if a table were missed from this list, masking exactly the kind of
// bug that matters most here. Every statement below is deliberately
// explicit and reviewable rather than generated from an automated table
// scan, for the same reason.
//
// Tables NEVER touched by this function (global/shared, or reference-only
// via a nullable tenant_id that SET NULLs automatically): roles,
// permissions, role_permissions, modules, business_templates,
// template_modules, template_default_settings, subscription_plans,
// platform_admins, platform_refresh_tokens, platform_audit_logs (tenant_id
// is nullable + ON DELETE SET NULL — the audit trail survives, correctly,
// with tenant_id nulled), platform_notifications (same pattern),
// platform_settings, system_backups, email_logs.
//
// IMPORTANT — static-code-audit basis, not live-DB-verified: this was
// built by reading migration source files, not by introspecting a running
// database's actual information_schema. Run the read-only pre-flight
// check this file also exports (countTenantOwnedRows) against a real
// tenant on staging before ever using this in production, and confirm the
// affected-row counts look sane before trusting a real deletion.

// Each entry is a raw SQL statement scoped to one tenant. Direct tables
// filter on their own tenant_id column; indirect tables (no tenant_id of
// their own) DELETE...JOIN back to whichever tenant-owned parent they
// belong to. Phase order matters — within a phase, order does not.
const DELETE_PHASES = [
  // Phase 1 — leaf tables (nothing else in this schema references them).
  [
    'DELETE lra FROM loan_repayment_allocations lra JOIN loan_repayments lr ON lr.id = lra.loan_repayment_id WHERE lr.tenant_id = ?',
    'DELETE ri FROM return_items ri JOIN returns r ON r.id = ri.return_id WHERE r.tenant_id = ?',
    'DELETE sp FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id WHERE s.tenant_id = ?',
    'DELETE ppi FROM pharmacy_purchase_items ppi JOIN pharmacy_purchases pp ON pp.id = ppi.purchase_id WHERE pp.tenant_id = ?',
    'DELETE psi FROM pharmacy_sale_items psi JOIN pharmacy_sales ps ON ps.id = psi.sale_id WHERE ps.tenant_id = ?',
    'DELETE FROM pharmacy_stock_movements WHERE tenant_id = ?',
    'DELETE roi FROM restaurant_order_items roi JOIN restaurant_orders ro ON ro.id = roi.order_id WHERE ro.tenant_id = ?',
    'DELETE rp FROM repair_parts rp JOIN repairs r ON r.id = rp.repair_id WHERE r.tenant_id = ?',
    'DELETE rsh FROM repair_status_history rsh JOIN repairs r ON r.id = rsh.repair_id WHERE r.tenant_id = ?',
    'DELETE rpay FROM repair_payments rpay JOIN repairs r ON r.id = rpay.repair_id WHERE r.tenant_id = ?',
    'DELETE pi FROM product_images pi JOIN products p ON p.id = pi.product_id WHERE p.tenant_id = ?',
    'DELETE qr FROM qr_codes qr JOIN products p ON p.id = qr.product_id WHERE p.tenant_id = ?',
    'DELETE ub FROM user_branches ub JOIN users u ON u.id = ub.user_id WHERE u.tenant_id = ?',
    'DELETE sti FROM stock_transfer_items sti JOIN stock_transfer_requests str ON str.id = sti.transfer_id WHERE str.tenant_id = ?',
    'DELETE FROM inventory_adjustments WHERE tenant_id = ?',
    'DELETE lg FROM loan_guarantors lg JOIN loans l ON l.id = lg.loan_id WHERE l.tenant_id = ?',
    'DELETE lgm FROM loan_group_members lgm JOIN loan_groups grp ON grp.id = lgm.loan_group_id WHERE grp.tenant_id = ?',
    'DELETE n FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.tenant_id = ?',
    'DELETE rt FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE u.tenant_id = ?',
    'DELETE pr FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE u.tenant_id = ?',
    'DELETE spay FROM supplier_payments spay JOIN suppliers s ON s.id = spay.supplier_id WHERE s.tenant_id = ?',
    'DELETE FROM audit_logs WHERE tenant_id = ?',
    'DELETE FROM activity_logs WHERE tenant_id = ?',
    'DELETE pi2 FROM purchase_items pi2 JOIN purchase_orders po ON po.id = pi2.purchase_order_id WHERE po.tenant_id = ?',
    'DELETE st FROM savings_transactions st JOIN savings_accounts sa ON sa.id = st.savings_account_id WHERE sa.tenant_id = ?',
    'DELETE FROM payments WHERE tenant_id = ?',
    'DELETE FROM subscription_events WHERE tenant_id = ?',
    'DELETE FROM tenant_modules WHERE tenant_id = ?',
    'DELETE FROM expenses WHERE tenant_id = ?',
    'DELETE FROM inventory WHERE tenant_id = ?',
    'DELETE FROM company_settings WHERE tenant_id = ?',
    'DELETE FROM system_settings WHERE tenant_id = ?',
    'DELETE FROM document_sequences WHERE tenant_id = ?',
    'DELETE FROM sms_logs WHERE tenant_id = ?',
  ],
  // Phase 2 — depends only on Phase 1 being cleared.
  [
    'DELETE s FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.tenant_id = ?',
    'DELETE ls FROM loan_schedules ls JOIN loans l ON l.id = ls.loan_id WHERE l.tenant_id = ?',
    'DELETE FROM loan_repayments WHERE tenant_id = ?',
    'DELETE FROM savings_accounts WHERE tenant_id = ?',
    'DELETE FROM medicine_batches WHERE tenant_id = ?',
    'DELETE FROM restaurant_orders WHERE tenant_id = ?',
    'DELETE FROM repairs WHERE tenant_id = ?',
    'DELETE si FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.tenant_id = ?',
    'DELETE FROM returns WHERE tenant_id = ?',
    'DELETE FROM purchase_orders WHERE tenant_id = ?',
    'DELETE FROM stock_transfer_requests WHERE tenant_id = ?',
    'DELETE FROM pharmacy_purchases WHERE tenant_id = ?',
    'DELETE FROM pharmacy_sales WHERE tenant_id = ?',
    'DELETE FROM menu_items WHERE tenant_id = ?',
    'DELETE FROM invoices WHERE tenant_id = ?',
    'DELETE FROM inventory_movements WHERE tenant_id = ?',
  ],
  // Phase 3 — depends on Phase 2.
  [
    'DELETE FROM loans WHERE tenant_id = ?',
    'DELETE FROM sales WHERE tenant_id = ?',
    'DELETE FROM medicines WHERE tenant_id = ?',
    'DELETE FROM restaurant_tables WHERE tenant_id = ?',
    'DELETE FROM tenant_subscriptions WHERE tenant_id = ?',
    'DELETE FROM products WHERE tenant_id = ?',
  ],
  // Phase 4 — depends on Phase 3.
  [
    'DELETE FROM customers WHERE tenant_id = ?',
    'DELETE FROM suppliers WHERE tenant_id = ?',
    'DELETE FROM loan_products WHERE tenant_id = ?',
    'DELETE FROM categories WHERE tenant_id = ?',
    'DELETE FROM brands WHERE tenant_id = ?',
    'DELETE FROM expense_categories WHERE tenant_id = ?',
    'DELETE FROM loan_groups WHERE tenant_id = ?',
  ],
  // Phase 5 — users before branches (branches.manager_id -> users is
  // SET NULL / non-blocking; users.branch_id -> branches is RESTRICT).
  [
    'DELETE FROM users WHERE tenant_id = ?',
    'DELETE FROM branches WHERE tenant_id = ?',
  ],
];

// Read-only pre-flight check — run this (or have an operator run it)
// against a real database before trusting a real deletion. Reports how
// many rows exist per table for this tenant so the admin can sanity-check
// the number against what they expect before confirming.
export async function countTenantOwnedRows(tenantId) {
  const counts = {};
  for (const phase of DELETE_PHASES) {
    for (const statement of phase) {
      // Every statement starts with either "DELETE FROM <table> ..." or
      // "DELETE <alias> FROM <table> <alias> JOIN ...", so swapping just
      // the leading "DELETE [alias] FROM" for "SELECT COUNT(*) AS total
      // FROM" turns it into an equivalent read-only count of the exact
      // same row set the real delete would remove.
      const countStatement = statement.replace(/^DELETE\s+(?:\w+\s+)?FROM/i, 'SELECT COUNT(*) AS total FROM');
      const label = statement.match(/^DELETE\s+(?:\w+\s+)?FROM\s+(\w+)/i)[1];
      try {
        const [[row]] = await pool.query(countStatement, [tenantId]);
        counts[label] = Number(row?.total || 0);
      } catch {
        counts[label] = null; // surfaced as "could not count" rather than silently omitted
      }
    }
  }
  return counts;
}

// The actual irreversible deletion. Runs every phase inside one
// transaction with the tenant row locked first (FOR UPDATE) so a
// concurrent request can't read/act on a tenant mid-deletion. Any failure
// at any phase rolls back everything — there is no partial-delete state.
export async function hardDeleteTenant(tenantId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[tenant]] = await connection.query('SELECT id, company_name, status FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);
    if (!tenant) throw new ApiError(404, 'Tenant not found');

    for (const phase of DELETE_PHASES) {
      for (const statement of phase) {
        await connection.query(statement, [tenantId]);
      }
    }

    await connection.query('DELETE FROM tenants WHERE id = ?', [tenantId]);

    await connection.commit();
    return { companyName: tenant.company_name };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
