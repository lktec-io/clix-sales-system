import { formatCurrency } from '../utils/formatCurrency.js';
import { t } from '../i18n/index.js';

// Single source of truth for "what a report contains" — title, summary
// labels, and breakdown-table definitions — shared by both the PDF and
// Excel renderers (and the CSV builder) so the three exporters can't drift
// apart from each other. Mirrors src/pages/reports/ReportsCenter.jsx's
// REPORT_CONFIGS (presentation labels only, not business logic — the
// underlying data always comes from the same unmodified
// reportService.getReport() every consumer uses).
//
// Locale-aware: buildReportConfigs(locale) below builds this same shape
// from backend/i18n/dictionaries.js so the server-rendered PDF/Excel/CSV
// headers match whichever language the request asked for — English keys
// stay hardcoded here only as the object's structural keys (report type,
// summary metric, breakdown key), never as the displayed label text.
export const MONEY_KEYS = new Set([
  'value', 'totalRevenue', 'totalAmount', 'totalDiscount', 'averageSale', 'totalValue',
  'salesRevenue', 'expenses', 'totalExpenses', 'net', 'cogs', 'grossProfit', 'netProfit', 'totalRefund',
  'totalPurchased', 'totalPaid', 'outstandingBalance',
  'totalDisbursed', 'totalOutstanding', 'totalCollected',
]);

function buildReportConfigs(locale) {
  const rt = (key) => t(locale, `reportTypes.${key}`);
  const sl = (key) => t(locale, `summaryLabels.${key}`);
  const bd = (key) => t(locale, `breakdowns.${key}`);
  const bh = (key) => t(locale, `breakdownHeaders.${key}`);

  return {
    sales: {
      title: rt('sales'),
      summaryLabels: { totalSales: sl('totalSales'), totalRevenue: sl('totalRevenue'), totalDiscount: sl('totalDiscount'), averageSale: sl('averageSale') },
      breakdowns: [{ key: 'byDay', title: bd('byDay'), labelHeader: bh('date') }, { key: 'byBranch', title: bd('byBranch'), labelHeader: bh('branch') }],
    },
    customers: {
      title: rt('customers'),
      summaryLabels: null,
      breakdowns: [{ key: 'topCustomers', title: bd('topCustomers'), labelHeader: bh('customer') }],
    },
    inventory: {
      title: rt('inventory'),
      summaryLabels: { totalRecords: sl('totalRecords'), totalValue: sl('totalValue'), lowStock: sl('lowStock'), outOfStock: sl('outOfStock') },
      breakdowns: [{ key: 'byCategory', title: bd('byCategory'), labelHeader: bh('category') }],
    },
    products: {
      title: rt('products'),
      summaryLabels: null,
      breakdowns: [{ key: 'topProducts', title: bd('topProducts'), labelHeader: bh('product') }],
    },
    purchases: {
      title: rt('purchases'),
      summaryLabels: { totalPurchases: sl('totalPurchases'), totalAmount: sl('totalAmount') },
      breakdowns: [{ key: 'bySupplier', title: bd('bySupplier'), labelHeader: bh('supplier') }],
    },
    returns: {
      title: rt('returns'),
      summaryLabels: { totalReturns: sl('totalReturns'), totalRefund: sl('totalRefund') },
      breakdowns: [{ key: 'byReason', title: bd('byReason'), labelHeader: bh('reason') }],
    },
    expenses: {
      title: rt('expenses'),
      summaryLabels: { totalExpenses: sl('totalExpenses'), totalAmount: sl('totalAmount') },
      breakdowns: [{ key: 'byCategory', title: bd('byCategory'), labelHeader: bh('category') }],
    },
    profit: {
      title: rt('profit'),
      summaryLabels: {
        salesRevenue: sl('salesRevenue'), totalRevenue: sl('totalRevenue'),
        cogs: sl('cogs'), grossProfit: sl('grossProfit'), expenses: sl('expenses'), netProfit: sl('netProfit'),
      },
      breakdowns: [{ key: 'byDay', title: bd('byDay'), labelHeader: bh('date') }],
    },
    branches: {
      title: rt('branches'),
      summaryLabels: null,
      breakdowns: [{ key: 'byBranch', title: bd('branchComparison'), labelHeader: bh('branch') }],
    },
    suppliers: {
      title: rt('suppliers'),
      summaryLabels: null,
      breakdowns: [{ key: 'bySupplier', title: bd('supplierBalances'), labelHeader: bh('supplier') }],
    },
    users: {
      title: rt('users'),
      summaryLabels: { totalUsers: sl('totalUsers'), activeUsers: sl('activeUsers'), suspendedUsers: sl('suspendedUsers'), lockedUsers: sl('lockedUsers') },
      breakdowns: [{ key: 'byRole', title: bd('byRole'), labelHeader: bh('role') }, { key: 'byBranch', title: bd('byBranch'), labelHeader: bh('branch') }],
    },
    loan_portfolio: {
      title: rt('loan_portfolio'),
      summaryLabels: { totalLoans: sl('totalLoans'), totalDisbursed: sl('totalDisbursed'), totalOutstanding: sl('totalOutstanding') },
      breakdowns: [{ key: 'byStatus', title: bd('byStatus'), labelHeader: bh('status') }, { key: 'byProduct', title: bd('byProduct'), labelHeader: bh('product') }],
    },
    loan_repayments: {
      title: rt('loan_repayments'),
      summaryLabels: { totalRepayments: sl('totalRepayments'), totalCollected: sl('totalCollected') },
      breakdowns: [{ key: 'byDay', title: bd('byDay'), labelHeader: bh('date') }, { key: 'byMethod', title: bd('byMethod'), labelHeader: bh('method') }],
    },
    // The business-summary report — report.service.js's buildAllReport()
    // flattens sales/products/customers/expenses/profit into this same
    // { summary, ...arrays } shape every other report already uses, so
    // nothing here (or in the PDF/Excel/CSV renderers) needs special-casing
    // beyond naming which flattened keys to show. report.analysis (a plain
    // string array, not a breakdown table) is handled separately by each
    // renderer since it isn't tabular.
    all: {
      title: rt('all'),
      summaryLabels: {
        totalSales: sl('totalSales'), totalRevenue: sl('totalRevenue'), totalExpenses: sl('totalExpenses'),
        netProfit: sl('netProfit'),
      },
      breakdowns: [
        { key: 'salesByDay', title: bd('salesByDay'), labelHeader: bh('date') },
        { key: 'salesByBranch', title: bd('salesByBranch'), labelHeader: bh('branch') },
        { key: 'topProducts', title: bd('topProducts'), labelHeader: bh('product') },
        { key: 'topCustomers', title: bd('topCustomers'), labelHeader: bh('customer') },
        { key: 'expensesByCategory', title: bd('expensesByCategory'), labelHeader: bh('category') },
      ],
    },
  };
}

export function humanize(key) {
  // Handles both camelCase keys (most breakdown columns) and snake_case
  // keys (a few pass a raw DB column straight through, e.g. customer_code)
  // — without the second replace, "customer_code" only capitalizes to
  // "Customer_code" since there's no capital letter for the first regex to
  // find and split on.
  const result = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function formatCell(key, value) {
  if (typeof value !== 'number') return String(value ?? '');
  return MONEY_KEYS.has(key) ? formatCurrency(value) : value.toLocaleString();
}

// Falls back to a generic, fully-derived layout for any report type not
// explicitly configured above (every other type reportService already
// supports, just not exposed as a pill in the Reports UI) — humanized
// labels, one table per array-valued field on the report. `locale`
// defaults to English so every existing call site that doesn't pass one
// keeps behaving exactly as before.
export function resolveConfig(type, report, locale = 'en') {
  const known = buildReportConfigs(locale)[type];
  if (known) return known;

  const breakdowns = Object.keys(report)
    .filter((key) => key !== 'summary' && Array.isArray(report[key]))
    .map((key) => ({ key, title: humanize(key), labelHeader: t(locale, 'breakdownHeaders.name') }));

  return {
    title: humanize(type),
    summaryLabels: report.summary ? Object.fromEntries(Object.keys(report.summary).map((k) => [k, humanize(k)])) : null,
    breakdowns,
  };
}

// "Sales_Report_2026-07-15.pdf", not "sales-report.pdf" — one function so
// the download's actual filename (frontend downloadBlob's `download`
// attribute wins over whatever Content-Disposition suggests) and the
// header both agree. The filename itself always stays derived from the
// title text — a Kiswahili title just produces a Kiswahili filename.
export function buildReportFilename(type, report, extension, locale = 'en') {
  const { title } = resolveConfig(type, report, locale);
  const datePart = new Date().toISOString().slice(0, 10);
  return `${title.replace(/\s+/g, '_')}_Report_${datePart}.${extension}`;
}
