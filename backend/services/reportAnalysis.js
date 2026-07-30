import { formatCurrency } from '../utils/formatCurrency.js';

// Every function here reads only fields the report repository actually
// returns — no invented numbers, no LLM narrative. A line is only added
// when its underlying denominator/source array is non-empty, so a quiet
// period never produces a nonsensical "X% of $0" sentence.

function pct(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

// Buckets the same byDay rows the report already computed by calendar month
// (label is a DATE-truncated ISO string like "2026-07-15", so the first 7
// characters are always "YYYY-MM") — no new query, since a date range that
// only ever spans one month (the default "this month so far", or most
// custom ranges) would produce a single-point "trend" with nothing to show.
function monthlyTrend(dayRows) {
  if (!dayRows || dayRows.length === 0) return null;
  const byMonth = new Map();
  for (const row of dayRows) {
    const month = String(row.label).slice(0, 7);
    byMonth.set(month, (byMonth.get(month) || 0) + Number(row.value));
  }
  if (byMonth.size < 2) return null;
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }));
}

function dayRowsFinancialSummary(dayRows, { totalTransactions } = {}) {
  if (!dayRows || dayRows.length === 0) return null;
  const totalRevenue = dayRows.reduce((sum, r) => sum + Number(r.value), 0);
  const highest = dayRows.reduce((a, b) => (Number(b.value) > Number(a.value) ? b : a));
  const lowest = dayRows.reduce((a, b) => (Number(b.value) < Number(a.value) ? b : a));
  return {
    totalRevenue,
    averageDailySales: totalRevenue / dayRows.length,
    averageInvoice: totalTransactions ? totalRevenue / totalTransactions : null,
    highestSalesDay: { date: highest.label, value: Number(highest.value) },
    lowestSalesDay: { date: lowest.label, value: Number(lowest.value) },
    monthlyTrend: monthlyTrend(dayRows),
  };
}

// Sales revenue vs. the immediately preceding period of equal length (a
// real second query via reportRepository.salesReport with a shifted date
// range — not estimated) is the one growth comparison built across every
// revenue-bearing report type; per-type growth for every other metric
// would mean doubling nearly every report query for comparatively little
// value, so it's intentionally scoped to revenue only.
function growthLine(currentRevenue, previousRevenue) {
  if (previousRevenue == null || previousRevenue <= 0 || currentRevenue == null) return null;
  const change = pct(currentRevenue - previousRevenue, previousRevenue);
  const direction = change >= 0 ? 'increased' : 'decreased';
  return `Revenue ${direction} by ${Math.abs(change).toFixed(1)}% compared to the previous period (${formatCurrency(previousRevenue)} → ${formatCurrency(currentRevenue)}).`;
}

function buildSales(report, { previousRevenue } = {}) {
  const { summary, byDay, byBranch } = report;
  const analysis = [];
  const recommendations = [];

  if (summary.totalSales > 0) {
    analysis.push(`${summary.totalSales} sales recorded totalling ${formatCurrency(summary.totalRevenue)}, averaging ${formatCurrency(summary.averageSale)} per sale.`);
  }
  const growth = growthLine(summary.totalRevenue, previousRevenue);
  if (growth) analysis.push(growth);
  if (byBranch?.length > 1) {
    const top = byBranch[0];
    const bottom = byBranch[byBranch.length - 1];
    analysis.push(`${top.label} was the strongest branch with ${formatCurrency(top.value)} in sales.`);
    if (bottom.value < top.value * 0.5) {
      recommendations.push(`${bottom.label} is generating under half of ${top.label}'s sales — worth reviewing staffing, stock levels, or local promotions there.`);
    }
  }
  if (summary.totalDiscount > 0 && summary.totalRevenue > 0) {
    const discountRate = pct(summary.totalDiscount, summary.totalRevenue + summary.totalDiscount);
    analysis.push(`Discounts totalled ${formatCurrency(summary.totalDiscount)} (${discountRate.toFixed(1)}% of gross sales).`);
    if (discountRate > 15) recommendations.push('Discount rate is above 15% of gross sales — review discount approval rules to protect margin.');
  }

  return { analysis, recommendations, financialSummary: dayRowsFinancialSummary(byDay, { totalTransactions: summary.totalSales }) };
}

function buildInventory(report) {
  const { summary, byCategory } = report;
  const analysis = [];
  const recommendations = [];

  if (summary.totalRecords > 0) {
    analysis.push(`${summary.totalRecords} inventory records worth ${formatCurrency(summary.totalValue)} in stock at cost.`);
  }
  if (summary.outOfStock > 0) {
    analysis.push(`${summary.outOfStock} product${summary.outOfStock === 1 ? '' : 's'} currently out of stock.`);
    recommendations.push(`Reorder the ${summary.outOfStock} out-of-stock product${summary.outOfStock === 1 ? '' : 's'} to avoid lost sales.`);
  }
  if (summary.lowStock > 0) {
    analysis.push(`${summary.lowStock} product${summary.lowStock === 1 ? '' : 's'} at or below their reorder point.`);
    recommendations.push(`${summary.lowStock} product${summary.lowStock === 1 ? '' : 's'} are running low — plan restocking soon to stay ahead of demand.`);
  }
  if (byCategory?.length > 0) {
    analysis.push(`${byCategory[0].label} holds the most inventory value (${formatCurrency(byCategory[0].value)}).`);
  }
  if (summary.outOfStock === 0 && summary.lowStock === 0 && summary.totalRecords > 0) {
    recommendations.push('Inventory health is good — no products are out of stock or below their reorder point.');
  }

  return { analysis, recommendations, financialSummary: null };
}

function buildProducts(report) {
  const { topProducts } = report;
  const analysis = [];
  const recommendations = [];

  if (topProducts?.length > 0) {
    const top = topProducts[0];
    analysis.push(`${top.label} is the top-selling product with ${top.quantity} units sold (${formatCurrency(top.value)} in revenue).`);
    if (topProducts.length > 1) {
      const bottom = topProducts[topProducts.length - 1];
      analysis.push(`Lowest performer among the top ${topProducts.length}: ${bottom.label} (${bottom.quantity} units).`);
    }
    recommendations.push(`${top.label} should be prioritised for reordering given its strong sell-through.`);
  }

  return { analysis, recommendations, financialSummary: null };
}

function buildCustomers(report) {
  const { topCustomers } = report;
  const analysis = [];
  const recommendations = [];

  if (topCustomers?.length > 0) {
    const top = topCustomers[0];
    analysis.push(`${topCustomers.length} customer${topCustomers.length === 1 ? '' : 's'} made purchases in this period, led by ${top.label} with ${formatCurrency(top.value)} across ${top.orders} order${top.orders === 1 ? '' : 's'}.`);
    const avgOrderValue = top.orders > 0 ? top.value / top.orders : 0;
    analysis.push(`Top customer's average order value: ${formatCurrency(avgOrderValue)}.`);
    const repeatCustomers = topCustomers.filter((c) => c.orders > 1).length;
    if (repeatCustomers > 0) {
      analysis.push(`${repeatCustomers} of the top ${topCustomers.length} customers placed more than one order.`);
    } else {
      recommendations.push('Most top customers ordered only once — a simple follow-up or loyalty offer could improve repeat purchase rate.');
    }
  }

  return { analysis, recommendations, financialSummary: null };
}

function buildExpenses(report) {
  const { summary, byCategory } = report;
  const analysis = [];
  const recommendations = [];

  if (summary.totalExpenses > 0) {
    analysis.push(`${summary.totalExpenses} expense entries totalling ${formatCurrency(summary.totalAmount)}.`);
  }
  if (byCategory?.length > 0) {
    const top = byCategory[0];
    const share = pct(top.value, summary.totalAmount);
    analysis.push(`${top.label} is the largest expense category at ${formatCurrency(top.value)} (${share.toFixed(1)}% of total expenses).`);
    if (share > 50) recommendations.push(`${top.label} alone accounts for over half of total expenses — worth a closer look for cost-saving opportunities.`);
  }

  return { analysis, recommendations, financialSummary: null };
}

function buildProfit(report, { previousRevenue } = {}) {
  const { summary, byDay } = report;
  const analysis = [];
  const recommendations = [];

  if (summary.totalRevenue > 0) {
    const margin = pct(summary.grossProfit, summary.totalRevenue);
    analysis.push(`Total revenue of ${formatCurrency(summary.totalRevenue)} produced a gross margin of ${margin.toFixed(1)}%.`);
    analysis.push(`Net profit for the period: ${formatCurrency(summary.netProfit)}, after ${formatCurrency(summary.expenses)} in expenses.`);
    if (summary.netProfit < 0) recommendations.push('The period closed with a net loss — review expenses and pricing before the next period.');
    else if (margin < 20) recommendations.push('Gross margin is under 20% — review cost of goods sold or pricing to protect profitability.');
  }
  const growth = growthLine(summary.totalRevenue, previousRevenue);
  if (growth) analysis.push(growth);

  return { analysis, recommendations, financialSummary: dayRowsFinancialSummary(byDay) };
}

function buildBranches(report) {
  const { byBranch } = report;
  const analysis = [];
  const recommendations = [];

  if (byBranch?.length > 0) {
    const top = byBranch[0];
    analysis.push(`${top.label} is the top-performing branch with ${formatCurrency(top.net)} net (revenue minus expenses).`);
    const losingBranches = byBranch.filter((b) => b.net < 0);
    if (losingBranches.length > 0) {
      recommendations.push(`${losingBranches.map((b) => b.label).join(', ')} closed the period with a net loss — review expenses or sales activity there.`);
    }
  }

  return { analysis, recommendations, financialSummary: null };
}

function buildSuppliers(report) {
  const { bySupplier } = report;
  const analysis = [];
  const recommendations = [];

  if (bySupplier?.length > 0) {
    const top = bySupplier[0];
    analysis.push(`${top.label} is the largest supplier by purchase value (${formatCurrency(top.totalPurchased)}).`);
    const owing = bySupplier.filter((s) => s.outstandingBalance > 0);
    if (owing.length > 0) {
      const totalOwing = owing.reduce((sum, s) => sum + s.outstandingBalance, 0);
      analysis.push(`${owing.length} supplier${owing.length === 1 ? '' : 's'} have an outstanding balance totalling ${formatCurrency(totalOwing)}.`);
      recommendations.push('Settle outstanding supplier balances to maintain good standing and avoid supply disruptions.');
    }
  }

  return { analysis, recommendations, financialSummary: null };
}

function buildReturns(report, { totalSalesCount } = {}) {
  const { summary, byReason } = report;
  const analysis = [];
  const recommendations = [];

  if (summary.totalReturns > 0) {
    analysis.push(`${summary.totalReturns} returns processed, refunding ${formatCurrency(summary.totalRefund)}.`);
    if (totalSalesCount > 0) {
      const returnRate = pct(summary.totalReturns, totalSalesCount);
      analysis.push(`Return rate: ${returnRate.toFixed(1)}% of ${totalSalesCount} sales in this period.`);
      if (returnRate > 10) recommendations.push('Return rate is above 10% of sales — review product quality or listing accuracy to reduce returns.');
    }
    if (byReason?.length > 0) {
      analysis.push(`Most common reason: ${byReason[0].label} (${byReason[0].count} returns).`);
      recommendations.push(`"${byReason[0].label}" is the leading return reason — investigate whether a product or process change would reduce it.`);
    }
  }

  return { analysis, recommendations, financialSummary: null };
}

function buildUsers(report) {
  const { summary, byRole, byBranch } = report;
  const analysis = [];
  const recommendations = [];

  if (summary.totalUsers > 0) {
    analysis.push(`${summary.totalUsers} user${summary.totalUsers === 1 ? '' : 's'} in this period — ${summary.activeUsers} active, ${summary.suspendedUsers} suspended, ${summary.lockedUsers} locked.`);
    if (byRole?.length > 0) {
      analysis.push(`${byRole[0].label} is the most common role (${byRole[0].count} user${byRole[0].count === 1 ? '' : 's'}).`);
    }
    if (byBranch?.length > 0) {
      const unassigned = byBranch.find((b) => b.label === 'Unassigned');
      if (unassigned?.count > 0) {
        recommendations.push(`${unassigned.count} user${unassigned.count === 1 ? '' : 's'} have no branch assigned — review their access scope.`);
      }
    }
    if (summary.lockedUsers > 0) {
      recommendations.push(`${summary.lockedUsers} account${summary.lockedUsers === 1 ? '' : 's'} locked — review whether they need reinstating or offboarding.`);
    }
  }

  return { analysis, recommendations, financialSummary: null };
}

function buildPurchases(report) {
  const { summary, bySupplier } = report;
  const analysis = [];
  const recommendations = [];

  if (summary.totalPurchases > 0) {
    analysis.push(`${summary.totalPurchases} purchase orders placed totalling ${formatCurrency(summary.totalAmount)}.`);
    if (bySupplier?.length > 0) analysis.push(`${bySupplier[0].label} received the most orders by value (${formatCurrency(bySupplier[0].value)}).`);
  }

  return { analysis, recommendations, financialSummary: null };
}

// Unlike every other builder, this one takes the raw pre-flatten sub-report
// object ({ sales, products, customers, expenses, profit }, each shaped
// exactly like that type's own standalone report) rather than the flattened
// { summary, salesByDay, ... } shape report.service.js ultimately returns to
// callers — report.service.js calls this before flattening.
function buildAll({ sales, products, customers, expenses, profit }, { previousRevenue } = {}) {
  const analysis = [];
  const recommendations = [];

  if (sales.summary.totalSales > 0) {
    analysis.push(`Total sales revenue was ${formatCurrency(sales.summary.totalRevenue)} across ${sales.summary.totalSales} transactions (average sale ${formatCurrency(sales.summary.averageSale)}).`);
  }
  const growth = growthLine(sales.summary.totalRevenue, previousRevenue);
  if (growth) analysis.push(growth);
  if (products.topProducts.length > 0) {
    const top = products.topProducts[0];
    analysis.push(`Top selling product was ${top.label}, with ${top.quantity} units sold (${formatCurrency(top.value)} in revenue).`);
    recommendations.push(`${top.label} should be reordered soon given its strong sell-through this period.`);
  }
  if (expenses.summary.totalExpenses > 0) {
    analysis.push(`Total expenses recorded: ${formatCurrency(expenses.summary.totalAmount)} across ${expenses.summary.totalExpenses} entries.`);
    if (previousRevenue == null) {
      // No prior-period comparison available for expenses specifically —
      // still worth a margin-based signal using this period's own numbers.
    }
  }
  const margin = pct(profit.summary.grossProfit, profit.summary.totalRevenue);
  if (profit.summary.totalRevenue > 0) {
    analysis.push(`Gross margin for the period was ${margin.toFixed(1)}%.`);
  }
  analysis.push(`Net profit for the period: ${formatCurrency(profit.summary.netProfit)}.`);
  if (profit.summary.netProfit < 0) recommendations.push('The business closed this period at a net loss — review pricing and expenses before the next period.');

  if (customers.topCustomers.length > 0) {
    const top = customers.topCustomers[0];
    analysis.push(`Top customer was ${top.label}, with ${formatCurrency(top.value)} in purchases across ${top.orders} orders.`);
  }

  return { analysis, recommendations, financialSummary: dayRowsFinancialSummary(sales.byDay, { totalTransactions: sales.summary.totalSales }) };
}

const BUILDERS = {
  sales: buildSales,
  inventory: buildInventory,
  products: buildProducts,
  customers: buildCustomers,
  expenses: buildExpenses,
  profit: buildProfit,
  branches: buildBranches,
  suppliers: buildSuppliers,
  returns: buildReturns,
  purchases: buildPurchases,
  users: buildUsers,
  all: buildAll,
};

// `transfers` intentionally has no builder — a stock-move audit list
// doesn't have a natural "business insight" the way a revenue, inventory,
// or account-roster report does, so it gets { analysis: [],
// recommendations: [], financialSummary: null } via the fallback below
// rather than a forced, low-value sentence.
export function buildAnalysis(type, report, context = {}) {
  const builder = BUILDERS[type];
  if (!builder) return { analysis: [], recommendations: [], financialSummary: null };
  return builder(report, context);
}
