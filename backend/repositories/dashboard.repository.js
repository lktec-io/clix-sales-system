import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

export async function getKpis(tenantId, branchIds) {
  const sales = buildScope({ tenantId, branchIds });
  const expenses = buildScope({ tenantId, branchIds });
  const inventory = buildScope({ tenantId, tenantColumn: 'i.tenant_id', branchIds, branchColumn: 'i.branch_id' });
  const transfers = buildScope({ tenantId, branchIds, branchColumn: 'destination_branch_id' });
  const purchases = buildScope({ tenantId, branchIds });

  const [[todaySales]] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS value FROM sales
     WHERE status = 'completed' AND DATE(created_at) = CURDATE() ${sales.clause}`,
    sales.params,
  );

  const [[monthlySales]] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS value FROM sales
     WHERE status = 'completed' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) ${sales.clause}`,
    sales.params,
  );

  const salesAliased = buildScope({ tenantId, tenantColumn: 's.tenant_id', branchIds, branchColumn: 's.branch_id' });
  // LEFT JOIN + COALESCE onto sale_items.buying_price_snapshot (see the 015
  // migration) — a sold product can be permanently deleted later; without
  // this fallback today's/this month's profit would understate cost the
  // moment that happens.
  const profitQuery = (dateCondition) => `
    SELECT COALESCE(SUM(si.line_total - (si.quantity * COALESCE(p.buying_price, si.buying_price_snapshot))), 0) AS value
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE s.status = 'completed' AND ${dateCondition}
    ${salesAliased.clause}
  `;
  const [[todayProfit]] = await pool.query(profitQuery('DATE(s.created_at) = CURDATE()'), salesAliased.params);
  const [[monthlyProfit]] = await pool.query(
    profitQuery('YEAR(s.created_at) = YEAR(CURDATE()) AND MONTH(s.created_at) = MONTH(CURDATE())'),
    salesAliased.params,
  );

  const [[totalCustomers]] = await pool.query(
    "SELECT COUNT(*) AS value FROM customers WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active'",
    [tenantId],
  );
  const [[totalSuppliers]] = await pool.query(
    "SELECT COUNT(*) AS value FROM suppliers WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active'",
    [tenantId],
  );
  const [[totalProducts]] = await pool.query(
    "SELECT COUNT(*) AS value FROM products WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active'",
    [tenantId],
  );

  const [[inventoryValue]] = await pool.query(
    `SELECT COALESCE(SUM(i.quantity * p.buying_price), 0) AS value
     FROM inventory i JOIN products p ON p.id = i.product_id
     WHERE 1 = 1 ${inventory.clause}`,
    inventory.params,
  );

  const [[lowStockCount]] = await pool.query(
    `SELECT COUNT(*) AS value FROM inventory i
     JOIN products p ON p.id = i.product_id
     WHERE i.quantity <= COALESCE(i.min_stock, p.min_stock) ${inventory.clause}`,
    inventory.params,
  );

  const [[todayExpenses]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS value FROM expenses WHERE expense_date = CURDATE() ${expenses.clause}`,
    expenses.params,
  );
  const [[monthlyExpenses]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS value FROM expenses
     WHERE YEAR(expense_date) = YEAR(CURDATE()) AND MONTH(expense_date) = MONTH(CURDATE()) ${expenses.clause}`,
    expenses.params,
  );

  const [[todayOrders]] = await pool.query(
    `SELECT COUNT(*) AS value FROM sales
     WHERE status = 'completed' AND DATE(created_at) = CURDATE() ${sales.clause}`,
    sales.params,
  );

  const [[pendingTransfers]] = await pool.query(
    `SELECT COUNT(*) AS value FROM stock_transfer_requests WHERE status = 'pending' ${transfers.clause}`,
    transfers.params,
  );
  const [[pendingPurchases]] = await pool.query(
    `SELECT COUNT(*) AS value FROM purchase_orders WHERE status = 'pending' ${purchases.clause}`,
    purchases.params,
  );

  return {
    todaySales: Number(todaySales.value),
    monthlySales: Number(monthlySales.value),
    todayProfit: Number(todayProfit.value),
    monthlyProfit: Number(monthlyProfit.value),
    totalCustomers: Number(totalCustomers.value),
    totalSuppliers: Number(totalSuppliers.value),
    totalProducts: Number(totalProducts.value),
    inventoryValue: Number(inventoryValue.value),
    lowStockCount: Number(lowStockCount.value),
    todayExpenses: Number(todayExpenses.value),
    monthlyExpenses: Number(monthlyExpenses.value),
    todayOrders: Number(todayOrders.value),
    pendingTransfers: Number(pendingTransfers.value),
    pendingPurchases: Number(pendingPurchases.value),
  };
}

const DAYS_BACK = 14;

// Today/Week/Month/Year filter tabs on the Sales Trend chart — each needs a
// different bucket grain (hour vs day vs month) and a different lookback
// window, not just a different LIMIT on the same daily query.
const SALES_TREND_RANGES = {
  today: {
    bucket: "DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')",
    where: 'DATE(created_at) = CURDATE()',
  },
  week: {
    bucket: 'DATE(created_at)',
    where: 'created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
  },
  month: {
    bucket: 'DATE(created_at)',
    where: 'created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
  },
  year: {
    bucket: "DATE_FORMAT(created_at, '%Y-%m-01')",
    where: 'created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)',
  },
};

export async function getSalesTrend(tenantId, branchIds, range = 'week') {
  const config = SALES_TREND_RANGES[range] || SALES_TREND_RANGES.week;
  const filter = buildScope({ tenantId, branchIds });
  const [rows] = await pool.query(
    `SELECT ${config.bucket} AS date, COALESCE(SUM(total_amount), 0) AS value, COUNT(*) AS count
     FROM sales
     WHERE status = 'completed' AND ${config.where} ${filter.clause}
     GROUP BY date ORDER BY date`,
    filter.params,
  );
  return rows;
}

export async function getRevenueTrend(tenantId, branchIds) {
  const salesFilter = buildScope({ tenantId, branchIds });
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount), 0) AS value
     FROM sales WHERE status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${salesFilter.clause}
     GROUP BY DATE(created_at) ORDER BY date`,
    [DAYS_BACK, ...salesFilter.params],
  );
  return rows;
}

export async function getExpenseTrend(tenantId, branchIds) {
  const filter = buildScope({ tenantId, branchIds });
  const [rows] = await pool.query(
    `SELECT expense_date AS date, COALESCE(SUM(amount), 0) AS value
     FROM expenses
     WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${filter.clause}
     GROUP BY expense_date ORDER BY expense_date`,
    [DAYS_BACK, ...filter.params],
  );
  return rows;
}

export async function getProfitTrend(tenantId, branchIds) {
  const filter = buildScope({ tenantId, tenantColumn: 's.tenant_id', branchIds, branchColumn: 's.branch_id' });
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(s.created_at, '%Y-%m') AS month,
            COALESCE(SUM(si.line_total - (si.quantity * COALESCE(p.buying_price, si.buying_price_snapshot))), 0) AS value
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN products p ON p.id = si.product_id
     WHERE s.status = 'completed' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) ${filter.clause}
     GROUP BY month ORDER BY month`,
    filter.params,
  );
  return rows;
}

// LEFT JOIN + COALESCE (see the 015 migration) so a since-deleted product
// that was genuinely a top seller still shows up here instead of quietly
// disappearing from "Top Products" the moment it's removed from the
// catalog. Grouped by the snapshot code (not p.id, NULL for every deleted
// product alike) so different deleted products don't collapse together;
// the image subquery naturally returns NULL for one (nothing to show), the
// same as a product that never had an image.
//
// The aggregation happens in an inner derived table that only ever selects
// grouped/aggregated columns (id via MAX() — see productsReport() in
// report.repository.js for why that's safe, not arbitrary, under
// ONLY_FULL_GROUP_BY). The per-row image lookup then runs in the *outer*
// query against that derived table's plain `id` column — outside any GROUP
// BY, so it's just an ordinary correlated subquery on a real column, not a
// grouped-column violation. Same rows, same order, same values as before;
// only where the image subquery's reference to the id resolves from has
// changed.
export async function getTopProducts(tenantId, branchIds, limit = 5) {
  const filter = buildScope({ tenantId, tenantColumn: 's.tenant_id', branchIds, branchColumn: 's.branch_id' });
  const [rows] = await pool.query(
    `SELECT agg.id, agg.name, agg.quantity, agg.revenue,
            (SELECT pi.image_path FROM product_images pi
             WHERE pi.product_id = agg.id ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1) AS image_path
     FROM (
       SELECT MAX(p.id) AS id, COALESCE(p.name, si.product_name_snapshot) AS name,
              SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.status = 'completed' ${filter.clause}
       GROUP BY COALESCE(p.code, si.product_code_snapshot), COALESCE(p.name, si.product_name_snapshot)
     ) agg
     ORDER BY agg.quantity DESC
     LIMIT ?`,
    [...filter.params, limit],
  );
  return rows;
}

export async function getBranchPerformance(tenantId, branchIds) {
  const filter = buildScope({ tenantId, tenantColumn: 'b.tenant_id', branchIds, branchColumn: 'b.id' });
  const [rows] = await pool.query(
    `SELECT b.id, b.name, COALESCE(SUM(s.total_amount), 0) AS value
     FROM branches b
     LEFT JOIN sales s ON s.branch_id = b.id AND s.status = 'completed'
       AND YEAR(s.created_at) = YEAR(CURDATE()) AND MONTH(s.created_at) = MONTH(CURDATE())
     WHERE b.deleted_at IS NULL AND b.status = 'active' ${filter.clause}
     GROUP BY b.id, b.name ORDER BY value DESC`,
    filter.params,
  );
  return rows;
}

export async function getInventorySummary(tenantId, branchIds) {
  const filter = buildScope({ tenantId, tenantColumn: 'i.tenant_id', branchIds, branchColumn: 'i.branch_id' });
  const [[row]] = await pool.query(
    `SELECT
       SUM(CASE WHEN i.quantity = 0 THEN 1 ELSE 0 END) AS outOfStock,
       SUM(CASE WHEN i.quantity > 0 AND i.quantity <= COALESCE(i.min_stock, p.min_stock) THEN 1 ELSE 0 END) AS lowStock,
       SUM(CASE WHEN i.quantity > COALESCE(i.min_stock, p.min_stock) THEN 1 ELSE 0 END) AS inStock
     FROM inventory i JOIN products p ON p.id = i.product_id
     WHERE 1 = 1 ${filter.clause}`,
    filter.params,
  );
  return {
    outOfStock: Number(row.outOfStock) || 0,
    lowStock: Number(row.lowStock) || 0,
    inStock: Number(row.inStock) || 0,
  };
}

// payment_method does NOT live on `sales` — it's on `sale_payments`, a
// separate one-row-per-payment table joined via sale_id (see
// 006_create_sales_pos.sql). A sale can have more than one payment row
// (split payments), so summing sp.amount per method — not s.total_amount —
// is both the only column that actually exists and the semantically
// correct figure. ENUM values: cash/mpesa/airtel_money/bank_transfer/card
// — there is no "credit" method anywhere in the schema, so it is
// deliberately not invented here. mpesa+airtel_money fold into "Mobile
// Money"; card is labeled "Card" (the closest honest match to a
// non-cash/non-bank/non-mobile payment) rather than fabricated as "Credit".
const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  bank_transfer: 'Bank',
  mpesa: 'Mobile Money',
  airtel_money: 'Mobile Money',
  card: 'Card',
};

export async function getPaymentStatus(tenantId, branchIds) {
  const filter = buildScope({ tenantId, tenantColumn: 's.tenant_id', branchIds, branchColumn: 's.branch_id' });
  const [rows] = await pool.query(
    `SELECT sp.payment_method, COALESCE(SUM(sp.amount), 0) AS value
     FROM sale_payments sp
     JOIN sales s ON s.id = sp.sale_id
     WHERE s.status = 'completed' ${filter.clause}
     GROUP BY sp.payment_method`,
    filter.params,
  );
  const totals = new Map();
  rows.forEach((row) => {
    const label = PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method;
    totals.set(label, (totals.get(label) || 0) + Number(row.value));
  });
  return Array.from(totals, ([name, value]) => ({ name, value }));
}

export async function getRevenueVsExpenses(tenantId, branchIds) {
  const salesFilter = buildScope({ tenantId, branchIds });
  const expenseFilter = buildScope({ tenantId, branchIds });
  const [rows] = await pool.query(
    `SELECT date, SUM(revenue) AS revenue, SUM(expenses) AS expenses FROM (
       SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount), 0) AS revenue, 0 AS expenses
       FROM sales WHERE status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${salesFilter.clause}
       GROUP BY DATE(created_at)
       UNION ALL
       SELECT expense_date AS date, 0 AS revenue, COALESCE(SUM(amount), 0) AS expenses
       FROM expenses WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ${expenseFilter.clause}
       GROUP BY expense_date
     ) combined
     GROUP BY date ORDER BY date`,
    [DAYS_BACK, ...salesFilter.params, DAYS_BACK, ...expenseFilter.params],
  );
  return rows.map((row) => ({
    date: row.date,
    revenue: Number(row.revenue),
    expenses: Number(row.expenses),
    profit: Number(row.revenue) - Number(row.expenses),
  }));
}

// Every figure here is a real, currently-true fact — nothing is simulated.
// "Online users" is approximated as accounts with a non-revoked, unexpired
// session row (sessions table, backend/database/migrations/
// 003_create_settings_sessions.sql) — a real proxy for "currently signed
// in", not literal live presence, since there is no heartbeat/presence
// tracking in this schema.
export async function getSystemStatus(tenantId) {
  const [[lastBackup]] = await pool.query(
    'SELECT created_at, status FROM system_backups ORDER BY created_at DESC LIMIT 1',
  );
  const [[onlineUsers]] = await pool.query(
    `SELECT COUNT(DISTINCT s.user_id) AS value FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE u.tenant_id = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [tenantId],
  );
  return {
    lastBackupAt: lastBackup?.created_at || null,
    lastBackupStatus: lastBackup?.status || null,
    onlineUsers: Number(onlineUsers.value) || 0,
  };
}
