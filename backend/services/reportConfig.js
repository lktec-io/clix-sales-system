import { formatCurrency } from '../utils/formatCurrency.js';

// Single source of truth for "what a report contains" — title, summary
// labels, and breakdown-table definitions — shared by both the PDF and
// Excel renderers (and the CSV builder) so the three exporters can't drift
// apart from each other. Mirrors src/pages/reports/ReportsCenter.jsx's
// REPORT_CONFIGS (presentation labels only, not business logic — the
// underlying data always comes from the same unmodified
// reportService.getReport() every consumer uses).
export const MONEY_KEYS = new Set([
  'value', 'totalRevenue', 'totalAmount', 'totalDiscount', 'averageSale', 'totalValue',
  'salesRevenue', 'expenses', 'totalExpenses', 'net', 'cogs', 'grossProfit', 'netProfit', 'totalRefund',
  'totalPurchased', 'totalPaid', 'outstandingBalance',
]);

export const REPORT_CONFIGS = {
  sales: {
    title: 'Sales',
    summaryLabels: { totalSales: 'Total Sales', totalRevenue: 'Total Revenue', totalDiscount: 'Total Discount', averageSale: 'Average Sale' },
    breakdowns: [{ key: 'byDay', title: 'By Day', labelHeader: 'Date' }, { key: 'byBranch', title: 'By Branch', labelHeader: 'Branch' }],
  },
  customers: {
    title: 'Customers',
    summaryLabels: null,
    breakdowns: [{ key: 'topCustomers', title: 'Top Customers', labelHeader: 'Customer' }],
  },
  inventory: {
    title: 'Inventory',
    summaryLabels: { totalRecords: 'Total Records', totalValue: 'Total Value', lowStock: 'Low Stock', outOfStock: 'Out of Stock' },
    breakdowns: [{ key: 'byCategory', title: 'By Category', labelHeader: 'Category' }],
  },
  products: {
    title: 'Products',
    summaryLabels: null,
    breakdowns: [{ key: 'topProducts', title: 'Top Products', labelHeader: 'Product' }],
  },
  purchases: {
    title: 'Purchases',
    summaryLabels: { totalPurchases: 'Total Purchases', totalAmount: 'Total Amount' },
    breakdowns: [{ key: 'bySupplier', title: 'By Supplier', labelHeader: 'Supplier' }],
  },
  returns: {
    title: 'Returns',
    summaryLabels: { totalReturns: 'Total Returns', totalRefund: 'Total Refund' },
    breakdowns: [{ key: 'byReason', title: 'By Reason', labelHeader: 'Reason' }],
  },
  expenses: {
    title: 'Expenses',
    summaryLabels: { totalExpenses: 'Total Expenses', totalAmount: 'Total Amount' },
    breakdowns: [{ key: 'byCategory', title: 'By Category', labelHeader: 'Category' }],
  },
  profit: {
    title: 'Profit',
    summaryLabels: {
      salesRevenue: 'Sales Revenue', totalRevenue: 'Total Revenue',
      cogs: 'Cost of Goods Sold', grossProfit: 'Gross Profit', expenses: 'Expenses', netProfit: 'Net Profit',
    },
    breakdowns: [{ key: 'byDay', title: 'By Day', labelHeader: 'Date' }],
  },
  branches: {
    title: 'Branches',
    summaryLabels: null,
    breakdowns: [{ key: 'byBranch', title: 'Branch Comparison', labelHeader: 'Branch' }],
  },
  suppliers: {
    title: 'Suppliers',
    summaryLabels: null,
    breakdowns: [{ key: 'bySupplier', title: 'Supplier Balances', labelHeader: 'Supplier' }],
  },
  users: {
    title: 'Users',
    summaryLabels: { totalUsers: 'Total Users', activeUsers: 'Active', suspendedUsers: 'Suspended', lockedUsers: 'Locked' },
    breakdowns: [{ key: 'byRole', title: 'By Role', labelHeader: 'Role' }, { key: 'byBranch', title: 'By Branch', labelHeader: 'Branch' }],
  },
  // The business-summary report — report.service.js's buildAllReport()
  // flattens sales/products/customers/expenses/profit into this same
  // { summary, ...arrays } shape every other report already uses, so
  // nothing here (or in the PDF/Excel/CSV renderers) needs special-casing
  // beyond naming which flattened keys to show. report.analysis (a plain
  // string array, not a breakdown table) is handled separately by each
  // renderer since it isn't tabular.
  all: {
    title: 'All Reports',
    summaryLabels: {
      totalSales: 'Total Sales', totalRevenue: 'Total Revenue', totalExpenses: 'Total Expenses',
      netProfit: 'Net Profit',
    },
    breakdowns: [
      { key: 'salesByDay', title: 'Sales By Day', labelHeader: 'Date' },
      { key: 'salesByBranch', title: 'Sales By Branch', labelHeader: 'Branch' },
      { key: 'topProducts', title: 'Top Products', labelHeader: 'Product' },
      { key: 'topCustomers', title: 'Top Customers', labelHeader: 'Customer' },
      { key: 'expensesByCategory', title: 'Expenses By Category', labelHeader: 'Category' },
    ],
  },
};

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
// labels, one table per array-valued field on the report.
export function resolveConfig(type, report) {
  const known = REPORT_CONFIGS[type];
  if (known) return known;

  const breakdowns = Object.keys(report)
    .filter((key) => key !== 'summary' && Array.isArray(report[key]))
    .map((key) => ({ key, title: humanize(key), labelHeader: 'Name' }));

  return {
    title: humanize(type),
    summaryLabels: report.summary ? Object.fromEntries(Object.keys(report.summary).map((k) => [k, humanize(k)])) : null,
    breakdowns,
  };
}

// "Sales_Report_2026-07-15.pdf", not "sales-report.pdf" — one function so
// the download's actual filename (frontend downloadBlob's `download`
// attribute wins over whatever Content-Disposition suggests) and the
// header both agree.
export function buildReportFilename(type, report, extension) {
  const { title } = resolveConfig(type, report);
  const datePart = new Date().toISOString().slice(0, 10);
  return `${title.replace(/\s+/g, '_')}_Report_${datePart}.${extension}`;
}
