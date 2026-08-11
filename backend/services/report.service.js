import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import * as reportRepository from '../repositories/report.repository.js';
import { buildAnalysis } from './reportAnalysis.js';

const REPORT_TYPES = [
  'sales', 'inventory', 'purchases', 'expenses', 'profit',
  'branches', 'products', 'customers', 'suppliers', 'returns', 'transfers', 'users', 'all',
  'loan_portfolio', 'loan_repayments',
  'pharmacy_sales', 'medicine_stock', 'medicine_expiry', 'pharmacy_purchases',
  'restaurant_sales',
  'repairs',
];

// The "by day" breakdowns (sales/profit) group by a naturally-unbounded
// dimension — every other breakdown groups by a small, capped set (category,
// branch, status, reason, supplier) or already has its own LIMIT. A caller
// could otherwise request a multi-year range and get one row per day with no
// cap; reject spans beyond this instead of silently truncating rows the UI
// would assume is complete.
const MAX_DATE_RANGE_DAYS = 400;

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const toIso = now.toISOString().slice(0, 10);
  const fromIso = from.toISOString().slice(0, 10);
  return { dateFrom: fromIso, dateTo: toIso };
}

// Reports must reflect live database data with no hardcoded values (per the
// spec's explicit business rule) — every report type below is a real
// aggregate query, not a stub. Date filters default to "this month so far"
// when the caller doesn't specify a range.
export async function getReport(type, query, user) {
  if (!REPORT_TYPES.includes(type)) {
    throw new ApiError(404, `Unknown report type "${type}"`);
  }

  const branchIds = await getAccessibleBranchIds(user);
  if (query.branchId) {
    const branchId = Number(query.branchId);
    if (branchIds !== null && !branchIds.includes(branchId)) {
      throw new ApiError(403, 'You do not have access to this branch');
    }
  }

  const { dateFrom, dateTo } = defaultDateRange();
  const filters = {
    tenantId: user.tenantId,
    dateFrom: query.dateFrom || dateFrom,
    dateTo: query.dateTo || dateTo,
    branchId: query.branchId ? Number(query.branchId) : undefined,
    categoryId: query.categoryId ? Number(query.categoryId) : undefined,
    supplierId: query.supplierId ? Number(query.supplierId) : undefined,
    cashierId: query.cashierId ? Number(query.cashierId) : undefined,
    customerId: query.customerId ? Number(query.customerId) : undefined,
    productId: query.productId ? Number(query.productId) : undefined,
    status: query.status || undefined,
    branchIds,
  };

  const spanDays = (new Date(filters.dateTo) - new Date(filters.dateFrom)) / 86400000;
  if (spanDays > MAX_DATE_RANGE_DAYS) {
    throw new ApiError(400, `Date range too large — please select a range of ${MAX_DATE_RANGE_DAYS} days or fewer.`);
  }

  // Revenue growth vs. the immediately preceding period of equal length is
  // only computed for the three revenue-bearing report types that surface
  // it (sales/profit/all) — it's a second real query (salesReport again,
  // shifted dates), not worth paying for on every report type.
  const needsPreviousRevenue = type === 'sales' || type === 'profit' || type === 'all';
  const previousRevenue = needsPreviousRevenue ? await getPreviousPeriodRevenue(filters) : null;

  // Return rate needs a same-period sales count as its denominator — one
  // extra real query (the same salesReport every "sales" report type
  // already runs, just for its count), not an estimate.
  const totalSalesCount = type === 'returns' ? (await reportRepository.salesReport(filters)).summary.totalSales : null;

  let report;
  switch (type) {
    case 'sales': report = await reportRepository.salesReport(filters); break;
    case 'inventory': report = await reportRepository.inventoryReport(filters); break;
    case 'purchases': report = await reportRepository.purchasesReport(filters); break;
    case 'expenses': report = await reportRepository.expensesReport(filters); break;
    case 'profit': report = await reportRepository.profitReport(filters); break;
    case 'branches': report = await reportRepository.branchesReport(filters); break;
    case 'products': report = await reportRepository.productsReport(filters); break;
    case 'customers': report = await reportRepository.customersReport(filters); break;
    case 'suppliers': report = await reportRepository.suppliersReport(filters.tenantId); break;
    case 'returns': report = await reportRepository.returnsReport(filters); break;
    case 'transfers': report = await reportRepository.transfersReport(filters); break;
    case 'users': report = await reportRepository.usersReport(filters); break;
    case 'loan_portfolio': report = await reportRepository.loanPortfolioReport(filters); break;
    case 'loan_repayments': report = await reportRepository.loanRepaymentsReport(filters); break;
    case 'pharmacy_sales': report = await reportRepository.pharmacySalesReport(filters); break;
    case 'medicine_stock': report = await reportRepository.medicineStockReport(filters); break;
    case 'medicine_expiry': report = await reportRepository.medicineExpiryReport(filters); break;
    case 'pharmacy_purchases': report = await reportRepository.pharmacyPurchasesReport(filters); break;
    case 'restaurant_sales': report = await reportRepository.restaurantSalesReport(filters); break;
    case 'repairs': report = await reportRepository.repairsReport(filters); break;
    case 'all': return buildAllReport(filters, { previousRevenue });
    default: throw new ApiError(404, `Unknown report type "${type}"`);
  }

  const { analysis, recommendations, financialSummary } = buildAnalysis(type, report, { previousRevenue, totalSalesCount });
  return { ...report, analysis, recommendations, financialSummary };
}

// One extra salesReport call with the date range shifted back by its own
// span (e.g. "this month" -> "last month", not a fixed 30 days) — reuses
// the existing, real query rather than estimating. Returns null when the
// shifted range would itself exceed the max span guard above, or on the
// (rare) invalid-date edge case, rather than throwing for what's a
// nice-to-have comparison, not the primary report data.
async function getPreviousPeriodRevenue(filters) {
  const from = new Date(filters.dateFrom);
  const to = new Date(filters.dateTo);
  const spanMs = to - from;
  if (!(spanMs >= 0)) return null;

  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  try {
    const previous = await reportRepository.salesReport({
      ...filters,
      dateFrom: prevFrom.toISOString().slice(0, 10),
      dateTo: prevTo.toISOString().slice(0, 10),
    });
    return previous.summary.totalRevenue;
  } catch {
    return null;
  }
}

// The "All Reports" business summary — reuses every existing report
// function unmodified (same real queries every individual report already
// runs, run in parallel) and flattens the results into the same flat
// { summary, ...breakdownArrays } shape every other report type already
// returns, so the existing generic frontend table/PDF/Excel/CSV renderers
// need no special-casing for this one type — only a new REPORT_CONFIGS
// entry (frontend + reportConfig.js) naming which flattened keys to show.
async function buildAllReport(filters, { previousRevenue } = {}) {
  const [sales, products, customers, expenses, profit] = await Promise.all([
    reportRepository.salesReport(filters),
    reportRepository.productsReport(filters),
    reportRepository.customersReport(filters),
    reportRepository.expensesReport(filters),
    reportRepository.profitReport(filters),
  ]);

  const { analysis, recommendations, financialSummary } = buildAnalysis(
    'all',
    { sales, products, customers, expenses, profit },
    { previousRevenue },
  );

  return {
    summary: {
      totalSales: sales.summary.totalSales,
      totalRevenue: profit.summary.totalRevenue,
      totalExpenses: expenses.summary.totalAmount,
      netProfit: profit.summary.netProfit,
    },
    salesByDay: sales.byDay,
    salesByBranch: sales.byBranch,
    topProducts: products.topProducts,
    topCustomers: customers.topCustomers,
    expensesByCategory: expenses.byCategory,
    analysis,
    recommendations,
    financialSummary,
  };
}

export function getReportTypes() {
  return REPORT_TYPES;
}
