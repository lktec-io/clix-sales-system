import { pool } from '../config/db.js';

// Every report accepts a resolved { dateFrom, dateTo } (service layer fills
// in a default range) and an optional branchIds scope (null = unrestricted).
function branchFilter(column, branchIds) {
  if (!branchIds) return { clause: '', params: [] };
  if (branchIds.length === 0) return { clause: 'AND 1 = 0', params: [] };
  return { clause: `AND ${column} IN (?)`, params: [branchIds] };
}

export async function salesReport({ dateFrom, dateTo, branchId, cashierId, customerId, productId, branchIds }) {
  const conditions = ["s.status = 'completed'", 's.created_at >= ?', 's.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params = [dateFrom, dateTo];
  if (branchId) { conditions.push('s.branch_id = ?'); params.push(branchId); }
  if (cashierId) { conditions.push('s.cashier_id = ?'); params.push(cashierId); }
  if (customerId) { conditions.push('s.customer_id = ?'); params.push(customerId); }
  if (productId) {
    conditions.push('EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.product_id = ?)');
    params.push(productId);
  }
  const scope = branchFilter('s.branch_id', branchIds);
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalSales, COALESCE(SUM(s.total_amount), 0) AS totalRevenue,
            COALESCE(SUM(s.discount_amount), 0) AS totalDiscount,
            COALESCE(AVG(s.total_amount), 0) AS averageSale
     FROM sales s ${where}`,
    allParams,
  );

  const [byDay] = await pool.query(
    `SELECT DATE(s.created_at) AS label, COUNT(*) AS count, COALESCE(SUM(s.total_amount), 0) AS value
     FROM sales s ${where} GROUP BY DATE(s.created_at) ORDER BY label`,
    allParams,
  );

  const [byBranch] = await pool.query(
    `SELECT b.name AS label, COUNT(*) AS count, COALESCE(SUM(s.total_amount), 0) AS value
     FROM sales s JOIN branches b ON b.id = s.branch_id ${where} GROUP BY b.id, b.name ORDER BY value DESC`,
    allParams,
  );

  return {
    summary: {
      totalSales: Number(summary.totalSales),
      totalRevenue: Number(summary.totalRevenue),
      totalDiscount: Number(summary.totalDiscount),
      averageSale: Number(summary.averageSale),
    },
    // mysql2 returns DECIMAL-derived aggregates (SUM(s.total_amount) here)
    // as strings unless `decimalNumbers: true` is set on the pool (it
    // isn't — see config/db.js) — every consumer (PDF/Excel/CSV renderers,
    // the frontend chart/table) expects real numbers the same way
    // `summary` above already is, so this normalizes at the source instead
    // of every caller needing to know to re-coerce it.
    byDay: byDay.map((row) => ({ ...row, count: Number(row.count), value: Number(row.value) })),
    byBranch: byBranch.map((row) => ({ ...row, count: Number(row.count), value: Number(row.value) })),
  };
}

export async function inventoryReport({ branchId, categoryId, branchIds }) {
  const conditions = ['p.deleted_at IS NULL'];
  const params = [];
  if (branchId) { conditions.push('i.branch_id = ?'); params.push(branchId); }
  if (categoryId) { conditions.push('p.category_id = ?'); params.push(categoryId); }
  const scope = branchFilter('i.branch_id', branchIds);
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalRecords, COALESCE(SUM(i.quantity * p.buying_price), 0) AS totalValue,
            SUM(CASE WHEN i.quantity = 0 THEN 1 ELSE 0 END) AS outOfStock,
            SUM(CASE WHEN i.quantity > 0 AND i.quantity <= COALESCE(i.min_stock, p.min_stock) THEN 1 ELSE 0 END) AS lowStock
     FROM inventory i JOIN products p ON p.id = i.product_id ${where}`,
    allParams,
  );

  const [byCategory] = await pool.query(
    `SELECT c.name AS label, SUM(i.quantity) AS quantity, COALESCE(SUM(i.quantity * p.buying_price), 0) AS value
     FROM inventory i JOIN products p ON p.id = i.product_id JOIN categories c ON c.id = p.category_id
     ${where} GROUP BY c.id, c.name ORDER BY value DESC`,
    allParams,
  );

  return {
    summary: {
      totalRecords: Number(summary.totalRecords),
      totalValue: Number(summary.totalValue),
      outOfStock: Number(summary.outOfStock) || 0,
      lowStock: Number(summary.lowStock) || 0,
    },
    // See salesReport's comment above — SUM()-derived columns come back as
    // strings from mysql2, normalized here for every downstream consumer.
    byCategory: byCategory.map((row) => ({ ...row, quantity: Number(row.quantity), value: Number(row.value) })),
  };
}

export async function purchasesReport({ dateFrom, dateTo, branchId, supplierId, status, productId, branchIds }) {
  const conditions = ['po.created_at >= ?', 'po.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params = [dateFrom, dateTo];
  if (branchId) { conditions.push('po.branch_id = ?'); params.push(branchId); }
  if (supplierId) { conditions.push('po.supplier_id = ?'); params.push(supplierId); }
  if (status) { conditions.push('po.status = ?'); params.push(status); }
  if (productId) {
    conditions.push('EXISTS (SELECT 1 FROM purchase_items pi WHERE pi.purchase_order_id = po.id AND pi.product_id = ?)');
    params.push(productId);
  }
  const scope = branchFilter('po.branch_id', branchIds);
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalPurchases, COALESCE(SUM(po.total_amount), 0) AS totalAmount
     FROM purchase_orders po ${where}`,
    allParams,
  );

  const [bySupplier] = await pool.query(
    `SELECT s.name AS label, COUNT(*) AS count, COALESCE(SUM(po.total_amount), 0) AS value
     FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
     ${where} GROUP BY s.id, s.name ORDER BY value DESC`,
    allParams,
  );

  return {
    summary: { totalPurchases: Number(summary.totalPurchases), totalAmount: Number(summary.totalAmount) },
    // See salesReport's comment above — SUM()-derived columns come back as
    // strings from mysql2, normalized here for every downstream consumer.
    bySupplier: bySupplier.map((row) => ({ ...row, count: Number(row.count), value: Number(row.value) })),
  };
}

export async function expensesReport({ dateFrom, dateTo, branchId, categoryId, branchIds }) {
  const conditions = ['e.deleted_at IS NULL', 'e.expense_date >= ?', 'e.expense_date <= ?'];
  const params = [dateFrom, dateTo];
  if (branchId) { conditions.push('e.branch_id = ?'); params.push(branchId); }
  if (categoryId) { conditions.push('e.expense_category_id = ?'); params.push(categoryId); }
  const scope = branchFilter('e.branch_id', branchIds);
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalExpenses, COALESCE(SUM(e.amount), 0) AS totalAmount FROM expenses e ${where}`,
    allParams,
  );

  const [byCategory] = await pool.query(
    `SELECT ec.name AS label, COUNT(*) AS count, COALESCE(SUM(e.amount), 0) AS value
     FROM expenses e JOIN expense_categories ec ON ec.id = e.expense_category_id
     ${where} GROUP BY ec.id, ec.name ORDER BY value DESC`,
    allParams,
  );

  return {
    summary: { totalExpenses: Number(summary.totalExpenses), totalAmount: Number(summary.totalAmount) },
    // See salesReport's comment above — SUM()-derived columns come back as
    // strings from mysql2, normalized here for every downstream consumer.
    byCategory: byCategory.map((row) => ({ ...row, count: Number(row.count), value: Number(row.value) })),
  };
}

// Profit = sales revenue - cost of goods sold - expenses.
// Purchases aren't subtracted directly — they become inventory (an asset);
// COGS at the moment of sale is what actually reduces profit.
export async function profitReport({ dateFrom, dateTo, branchId, branchIds }) {
  const salesConditions = ["s.status = 'completed'", 's.created_at >= ?', 's.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const salesParams = [dateFrom, dateTo];
  if (branchId) { salesConditions.push('s.branch_id = ?'); salesParams.push(branchId); }
  const salesScope = branchFilter('s.branch_id', branchIds);
  const salesWhere = `WHERE ${salesConditions.join(' AND ')} ${salesScope.clause}`;
  const salesAllParams = [...salesParams, ...salesScope.params];

  const [[revenueRow]] = await pool.query(
    `SELECT COALESCE(SUM(s.total_amount), 0) AS revenue FROM sales s ${salesWhere}`,
    salesAllParams,
  );

  // LEFT JOIN + COALESCE onto sale_items.buying_price_snapshot (see the 015
  // migration) — a sold product can be permanently deleted later; without
  // this fallback its cost would silently read NULL/0 here, understating
  // COGS (and so overstating gross profit) for every past sale of it.
  const [[cogsRow]] = await pool.query(
    `SELECT COALESCE(SUM(si.quantity * COALESCE(p.buying_price, si.buying_price_snapshot)), 0) AS cogs
     FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN products p ON p.id = si.product_id
     ${salesWhere}`,
    salesAllParams,
  );

  const expenseConditions = ['e.deleted_at IS NULL', 'e.expense_date >= ?', 'e.expense_date <= ?'];
  const expenseParams = [dateFrom, dateTo];
  if (branchId) { expenseConditions.push('e.branch_id = ?'); expenseParams.push(branchId); }
  const expenseScope = branchFilter('e.branch_id', branchIds);
  const [[expenseRow]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenses e
     WHERE ${expenseConditions.join(' AND ')} ${expenseScope.clause}`,
    [...expenseParams, ...expenseScope.params],
  );

  const [byDay] = await pool.query(
    `SELECT DATE(s.created_at) AS label,
            COALESCE(SUM(si.line_total - (si.quantity * COALESCE(p.buying_price, si.buying_price_snapshot))), 0) AS value
     FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN products p ON p.id = si.product_id
     ${salesWhere} GROUP BY DATE(s.created_at) ORDER BY label`,
    salesAllParams,
  );

  const salesRevenue = Number(revenueRow.revenue);
  const cogs = Number(cogsRow.cogs);
  const expenses = Number(expenseRow.total);
  const totalRevenue = salesRevenue;
  const grossProfit = totalRevenue - cogs;
  const netProfit = grossProfit - expenses;

  return {
    summary: { salesRevenue, totalRevenue, cogs, grossProfit, expenses, netProfit },
    // See salesReport's comment above — SUM()-derived columns come back as
    // strings from mysql2, normalized here for every downstream consumer.
    byDay: byDay.map((row) => ({ ...row, value: Number(row.value) })),
  };
}

export async function branchesReport({ dateFrom, dateTo, branchIds }) {
  const scope = branchFilter('b.id', branchIds);
  const [rows] = await pool.query(
    `SELECT b.id, b.name AS label,
       COALESCE((SELECT SUM(s.total_amount) FROM sales s
         WHERE s.branch_id = b.id AND s.status = 'completed'
           AND s.created_at >= ? AND s.created_at < DATE_ADD(?, INTERVAL 1 DAY)), 0) AS salesRevenue,
       COALESCE((SELECT SUM(e.amount) FROM expenses e
         WHERE e.branch_id = b.id AND e.deleted_at IS NULL
           AND e.expense_date >= ? AND e.expense_date <= ?), 0) AS expenses
     FROM branches b
     WHERE b.deleted_at IS NULL ${scope.clause}
     ORDER BY salesRevenue DESC`,
    [dateFrom, dateTo, dateFrom, dateTo, ...scope.params],
  );

  const byBranch = rows.map((row) => ({
    label: row.label,
    salesRevenue: Number(row.salesRevenue),
    expenses: Number(row.expenses),
    net: Number(row.salesRevenue) - Number(row.expenses),
  }));

  return { byBranch };
}

export async function productsReport({ dateFrom, dateTo, branchId, categoryId, branchIds, limit = 20 }) {
  const conditions = ["s.status = 'completed'", 's.created_at >= ?', 's.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params = [dateFrom, dateTo];
  if (branchId) { conditions.push('s.branch_id = ?'); params.push(branchId); }
  if (categoryId) { conditions.push('p.category_id = ?'); params.push(categoryId); }
  const scope = branchFilter('s.branch_id', branchIds);
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  // LEFT JOIN + COALESCE (see the 015 migration) so a since-deleted
  // product's past sales still count here instead of disappearing.
  // categoryId can't match a deleted product (it has no live category
  // anymore), which is an acceptable narrowing of a category-filtered
  // breakdown — the overall sales/profit totals above aren't affected.
  // Grouped by the *_snapshot code (not p.id, which is NULL for every
  // deleted product alike) so multiple different deleted products don't
  // collapse into a single combined row.
  //
  // p.id is wrapped in MAX() — not selected raw — because ONLY_FULL_GROUP_BY
  // (correctly) can't prove it's single-valued per group from the GROUP BY
  // clause alone. It provably IS, though: p.code is UNIQUE per product, so
  // within one COALESCE(p.code, snapshot) group there is at most one live
  // product, meaning p.id is either that one product's id or NULL (deleted)
  // for every row in the group — never two different ids. MAX() picks that
  // single value deterministically; it does not pick "an arbitrary row" the
  // way it would for a genuinely multi-valued column.
  const [topProducts] = await pool.query(
    `SELECT MAX(p.id) AS id, COALESCE(p.name, si.product_name_snapshot) AS label, COALESCE(p.code, si.product_code_snapshot) AS code,
            SUM(si.quantity) AS quantity, COALESCE(SUM(si.line_total), 0) AS value
     FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN products p ON p.id = si.product_id
     ${where} GROUP BY COALESCE(p.code, si.product_code_snapshot), COALESCE(p.name, si.product_name_snapshot)
     ORDER BY quantity DESC LIMIT ?`,
    [...allParams, limit],
  );

  // See salesReport's comment above — SUM()-derived columns come back as
  // strings from mysql2, normalized here for every downstream consumer.
  return { topProducts: topProducts.map((row) => ({ ...row, quantity: Number(row.quantity), value: Number(row.value) })) };
}

export async function customersReport({ dateFrom, dateTo, branchId, branchIds, limit = 20 }) {
  const conditions = ["s.status = 'completed'", 's.customer_id IS NOT NULL', 's.created_at >= ?', 's.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params = [dateFrom, dateTo];
  if (branchId) { conditions.push('s.branch_id = ?'); params.push(branchId); }
  const scope = branchFilter('s.branch_id', branchIds);
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const [topCustomers] = await pool.query(
    `SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) AS label, c.customer_code,
            COUNT(*) AS orders, COALESCE(SUM(s.total_amount), 0) AS value
     FROM sales s JOIN customers c ON c.id = s.customer_id
     ${where} GROUP BY c.id, c.first_name, c.last_name, c.customer_code ORDER BY value DESC LIMIT ?`,
    [...allParams, limit],
  );

  // See salesReport's comment above — SUM()-derived columns come back as
  // strings from mysql2, normalized here for every downstream consumer.
  return { topCustomers: topCustomers.map((row) => ({ ...row, orders: Number(row.orders), value: Number(row.value) })) };
}

export async function suppliersReport() {
  const [rows] = await pool.query(
    `SELECT s.id, s.name AS label,
            COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po WHERE po.supplier_id = s.id AND po.status != 'cancelled'), 0) AS totalPurchased,
            COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) AS totalPaid
     FROM suppliers s
     WHERE s.deleted_at IS NULL
     ORDER BY totalPurchased DESC`,
  );

  const bySupplier = rows.map((row) => ({
    label: row.label,
    totalPurchased: Number(row.totalPurchased),
    totalPaid: Number(row.totalPaid),
    outstandingBalance: Number(row.totalPurchased) - Number(row.totalPaid),
  }));

  return { bySupplier };
}

export async function returnsReport({ dateFrom, dateTo, branchId, status, customerId, productId, branchIds }) {
  const conditions = ['r.created_at >= ?', 'r.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params = [dateFrom, dateTo];
  if (branchId) { conditions.push('s.branch_id = ?'); params.push(branchId); }
  if (status) { conditions.push('r.status = ?'); params.push(status); }
  if (customerId) { conditions.push('r.customer_id = ?'); params.push(customerId); }
  if (productId) {
    conditions.push('EXISTS (SELECT 1 FROM return_items ri JOIN sale_items si ON si.id = ri.sale_item_id WHERE ri.return_id = r.id AND si.product_id = ?)');
    params.push(productId);
  }
  const scope = branchFilter('s.branch_id', branchIds);
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalReturns, COALESCE(SUM(r.refund_amount), 0) AS totalRefund
     FROM returns r JOIN sales s ON s.id = r.sale_id ${where}`,
    allParams,
  );

  const [byReason] = await pool.query(
    `SELECT r.reason AS label, COUNT(*) AS count, COALESCE(SUM(r.refund_amount), 0) AS value
     FROM returns r JOIN sales s ON s.id = r.sale_id ${where} GROUP BY r.reason ORDER BY value DESC`,
    allParams,
  );

  return {
    summary: { totalReturns: Number(summary.totalReturns), totalRefund: Number(summary.totalRefund) },
    // See salesReport's comment above — SUM()-derived columns come back as
    // strings from mysql2, normalized here for every downstream consumer.
    byReason: byReason.map((row) => ({ ...row, count: Number(row.count), value: Number(row.value) })),
  };
}

export async function transfersReport({ dateFrom, dateTo, branchId, branchIds }) {
  const conditions = ['t.created_at >= ?', 't.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params = [dateFrom, dateTo];
  if (branchId) { conditions.push('(t.source_branch_id = ? OR t.destination_branch_id = ?)'); params.push(branchId, branchId); }
  const scope = (() => {
    if (!branchIds) return { clause: '', params: [] };
    if (branchIds.length === 0) return { clause: 'AND 1 = 0', params: [] };
    return { clause: 'AND (t.source_branch_id IN (?) OR t.destination_branch_id IN (?))', params: [branchIds, branchIds] };
  })();
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalTransfers FROM stock_transfer_requests t ${where}`,
    allParams,
  );

  const [byStatus] = await pool.query(
    `SELECT t.status AS label, COUNT(*) AS count
     FROM stock_transfer_requests t ${where} GROUP BY t.status ORDER BY count DESC`,
    allParams,
  );

  return {
    summary: { totalTransfers: Number(summary.totalTransfers) },
    byStatus: byStatus.map((row) => ({ ...row, count: Number(row.count) })),
  };
}

export async function usersReport({ dateFrom, dateTo, branchId, branchIds }) {
  const conditions = ['u.deleted_at IS NULL', 'u.created_at >= ?', 'u.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params = [dateFrom, dateTo];
  if (branchId) { conditions.push('u.branch_id = ?'); params.push(branchId); }
  const scope = branchFilter('u.branch_id', branchIds);
  const where = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalUsers,
            SUM(u.status = 'active') AS activeUsers,
            SUM(u.status = 'suspended') AS suspendedUsers,
            SUM(u.status = 'locked') AS lockedUsers
     FROM users u ${where}`,
    allParams,
  );

  const [byRole] = await pool.query(
    `SELECT r.name AS label, COUNT(*) AS count
     FROM users u JOIN roles r ON r.id = u.role_id
     ${where} GROUP BY r.id, r.name ORDER BY count DESC`,
    allParams,
  );

  const [byBranch] = await pool.query(
    `SELECT COALESCE(b.name, 'Unassigned') AS label, COUNT(*) AS count
     FROM users u LEFT JOIN branches b ON b.id = u.branch_id
     ${where} GROUP BY b.id, b.name ORDER BY count DESC`,
    allParams,
  );

  return {
    summary: {
      totalUsers: Number(summary.totalUsers),
      activeUsers: Number(summary.activeUsers) || 0,
      suspendedUsers: Number(summary.suspendedUsers) || 0,
      lockedUsers: Number(summary.lockedUsers) || 0,
    },
    byRole: byRole.map((row) => ({ ...row, count: Number(row.count) })),
    byBranch: byBranch.map((row) => ({ ...row, count: Number(row.count) })),
  };
}
