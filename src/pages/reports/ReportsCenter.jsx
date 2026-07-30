import { useEffect, useMemo, useState } from 'react';
import {
  FiPrinter, FiDownload, FiFileText, FiBarChart2, FiGrid, FiTrendingUp,
  FiDollarSign, FiPackage, FiBox, FiUsers, FiTruck, FiCreditCard, FiLayers,
} from 'react-icons/fi';
import KPICard from '../../components/dashboard/KPICard';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import { usePermission } from '../../hooks/usePermission';
import { useCompany } from '../../hooks/useCompany';
import * as reportService from '../../services/reportService';
import * as branchService from '../../services/branchService';
import * as categoryService from '../../services/categoryService';
import * as customerService from '../../services/customerService';
import * as productService from '../../services/productService';
import * as userService from '../../services/userService';
import { formatCurrency } from '../../utils/formatCurrency';
import { downloadCsv } from '../../utils/exportCsv';
import '../../styles/pages/Reports.css';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Monday-based week start, matching regional convention (no other date-range
// widget in the app currently defines a week start, so this is the first).
function startOfWeekIso() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function firstOfLastMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
}

function lastOfLastMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
}

function firstOfYearIso() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

const DATE_PRESETS = {
  today: () => [todayIso(), todayIso()],
  yesterday: () => [yesterdayIso(), yesterdayIso()],
  week: () => [startOfWeekIso(), todayIso()],
  last7: () => [daysAgoIso(6), todayIso()],
  last30: () => [daysAgoIso(29), todayIso()],
  month: () => [firstOfMonthIso(), todayIso()],
  lastMonth: () => [firstOfLastMonthIso(), lastOfLastMonthIso()],
  year: () => [firstOfYearIso(), todayIso()],
};

const MONEY_KEYS = new Set([
  'value', 'totalRevenue', 'totalAmount', 'totalDiscount', 'averageSale', 'totalValue',
  'salesRevenue', 'expenses', 'totalExpenses', 'net', 'cogs', 'grossProfit', 'netProfit',
  'totalPurchased', 'totalPaid', 'outstandingBalance', 'averageDailySales', 'averageInvoice',
]);

const PURCHASE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const RETURN_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const REPORT_CONFIGS = {
  sales: {
    label: 'Sales', filters: ['dateFrom', 'dateTo', 'branchId', 'cashierId', 'customerId', 'productId'],
    summary: { totalSales: 'Total Sales', totalRevenue: 'Total Revenue', totalDiscount: 'Total Discount', averageSale: 'Average Sale' },
    breakdowns: [{ key: 'byDay', title: 'By Day', labelHeader: 'Date' }, { key: 'byBranch', title: 'By Branch', labelHeader: 'Branch' }],
  },
  suppliers: {
    label: 'Suppliers', filters: [],
    breakdowns: [{ key: 'bySupplier', title: 'Supplier Balances', labelHeader: 'Supplier' }],
  },
  customers: {
    label: 'Customers', filters: ['dateFrom', 'dateTo', 'branchId'],
    breakdowns: [{ key: 'topCustomers', title: 'Top Customers', labelHeader: 'Customer' }],
  },
  inventory: {
    label: 'Inventory', filters: ['branchId', 'categoryId'],
    summary: { totalRecords: 'Total Records', totalValue: 'Total Value', lowStock: 'Low Stock', outOfStock: 'Out of Stock' },
    breakdowns: [{ key: 'byCategory', title: 'By Category', labelHeader: 'Category' }],
  },
  products: {
    label: 'Products', filters: ['dateFrom', 'dateTo', 'branchId', 'categoryId'],
    breakdowns: [{ key: 'topProducts', title: 'Top Products', labelHeader: 'Product' }],
  },
  purchases: {
    label: 'Purchases', filters: ['dateFrom', 'dateTo', 'branchId', 'status', 'productId'],
    statusOptions: PURCHASE_STATUS_OPTIONS,
    summary: { totalPurchases: 'Total Purchases', totalAmount: 'Total Amount' },
    breakdowns: [{ key: 'bySupplier', title: 'By Supplier', labelHeader: 'Supplier' }],
  },
  returns: {
    label: 'Returns', filters: ['dateFrom', 'dateTo', 'branchId', 'status', 'customerId', 'productId'],
    statusOptions: RETURN_STATUS_OPTIONS,
    summary: { totalReturns: 'Total Returns', totalRefund: 'Total Refund' },
    breakdowns: [{ key: 'byReason', title: 'By Reason', labelHeader: 'Reason' }],
  },
  expenses: {
    label: 'Expenses', filters: ['dateFrom', 'dateTo', 'branchId', 'categoryId'],
    summary: { totalExpenses: 'Total Expenses', totalAmount: 'Total Amount' },
    breakdowns: [{ key: 'byCategory', title: 'By Category', labelHeader: 'Category' }],
  },
  profit: {
    label: 'Profit', filters: ['dateFrom', 'dateTo', 'branchId'],
    summary: {
      salesRevenue: 'Sales Revenue', totalRevenue: 'Total Revenue',
      cogs: 'Cost of Goods Sold', grossProfit: 'Gross Profit', expenses: 'Expenses', netProfit: 'Net Profit',
    },
    breakdowns: [{ key: 'byDay', title: 'By Day', labelHeader: 'Date' }],
  },
  branches: {
    label: 'Branches', filters: ['dateFrom', 'dateTo'],
    breakdowns: [{ key: 'byBranch', title: 'Branch Comparison', labelHeader: 'Branch' }],
  },
  users: {
    label: 'Users', filters: ['dateFrom', 'dateTo', 'branchId'],
    summary: { totalUsers: 'Total Users', activeUsers: 'Active', suspendedUsers: 'Suspended', lockedUsers: 'Locked' },
    breakdowns: [{ key: 'byRole', title: 'By Role', labelHeader: 'Role' }, { key: 'byBranch', title: 'By Branch', labelHeader: 'Branch' }],
  },
  // Combined business-summary report — backend/services/report.service.js's
  // buildAllReport() flattens Sales/Products/Customers/Expenses/Profit into
  // this exact shape, so it renders through the same summary cards +
  // BreakdownTable components every other report type already uses.
  // `analysis` is the one field that isn't a breakdown table — it's
  // rendered separately, right below the summary cards.
  all: {
    label: 'All Reports', filters: ['dateFrom', 'dateTo', 'branchId'],
    summary: {
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

// "Show only: Sales, Product, Inventory, Customer, Supplier, Expenses, All
// Reports" — the other REPORT_CONFIGS entries (purchases/returns/profit/
// branches/users) stay fully supported by the backend and this same
// generic renderer; they're just no longer offered as a card here, so
// nothing about how a report actually renders needed to change.
const VISIBLE_REPORT_TYPES = ['sales', 'products', 'inventory', 'customers', 'suppliers', 'expenses', 'all'];

const REPORT_ICONS = {
  sales: FiDollarSign,
  products: FiPackage,
  inventory: FiBox,
  customers: FiUsers,
  suppliers: FiTruck,
  expenses: FiCreditCard,
  all: FiLayers,
};

const REPORT_DESCRIPTIONS = {
  sales: 'Revenue, transactions, and daily trends.',
  products: 'Best-selling products by quantity and revenue.',
  inventory: 'Stock levels, value, and low-stock alerts.',
  customers: 'Top customers by spend and order count.',
  suppliers: 'Purchase totals and outstanding balances.',
  expenses: 'Spending by category for the period.',
  all: 'A combined business summary across every area.',
};

function humanize(key) {
  const result = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function renderCell(key, value) {
  if (typeof value !== 'number') return value;
  return MONEY_KEYS.has(key) ? formatCurrency(value) : value.toLocaleString();
}

function BreakdownTable({ title, labelHeader, rows, onExport, canExport }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{title}</span></div>
        <div className="card-body">
          <EmptyState icon={FiBarChart2} title="No data" description="No data for the selected filters." />
        </div>
      </div>
    );
  }

  const columns = Object.keys(rows[0]).filter((c) => c !== 'id' && c !== 'code');

  return (
    <div className="card mb-5">
      <div className="card-header">
        <span className="card-title">{title}</span>
        {canExport && (
          <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => onExport(title, rows)}>
            <FiDownload aria-hidden="true" /> CSV
          </button>
        )}
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>{columns.map((c) => <th key={c}>{c === 'label' ? labelHeader : humanize(c)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((c) => <td key={c}>{renderCell(c, row[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsCenter() {
  const canExport = usePermission('reports.export');
  const canViewUsers = usePermission('users.view');
  const { company } = useCompany();
  const [reportType, setReportType] = useState('sales');
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [datePreset, setDatePreset] = useState('month');
  const [filters, setFilters] = useState({
    dateFrom: firstOfMonthIso(), dateTo: todayIso(), branchId: '', categoryId: '', status: '', customerId: '', productId: '', cashierId: '',
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const config = REPORT_CONFIGS[reportType];

  useEffect(() => {
    branchService.listActiveBranches().then(setBranches);
    categoryService.listActiveCategories().then(setCategories);
    customerService.listActiveCustomers().then(setCustomers);
    productService.listProducts({ limit: 200 }).then((result) => setProducts(result.items || []));
    // Cashier filter needs the users list, which 403s for a role without
    // users.view (e.g. Cashier/Sales viewing their own Reports) — only
    // fetched, and only offered as a filter, for roles that can see it.
    if (canViewUsers) {
      userService.listUsers({ limit: 200 }).then((result) => setCashiers(result.items || []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canViewUsers is derived from the user's role and stable for the component's lifetime
  }, []);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    const [from, to] = DATE_PRESETS[preset]();
    setFilters((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
  };

  const loadReport = () => {
    setLoading(true);
    setError('');
    const params = {};
    config.filters.forEach((key) => {
      if (filters[key]) params[key] = filters[key];
    });
    reportService
      .getReport(reportType, params)
      .then(setReport)
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the selected report on filter/type change is standard data-fetching, not derived state
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config is derived from reportType, individual filter fields tracked explicitly below
  }, [reportType, filters.dateFrom, filters.dateTo, filters.branchId, filters.categoryId, filters.status, filters.customerId, filters.productId, filters.cashierId]);

  const summaryEntries = useMemo(() => {
    if (!report?.summary || !config.summary) return [];
    return Object.entries(config.summary).map(([key, label]) => ({ key, label, value: report.summary[key] }));
  }, [report, config]);

  // Whichever day-based breakdown this report type has (sales/profit use
  // byDay, the combined "all" report uses salesByDay) becomes the trend
  // line — reports with no date breakdown (inventory, customers, ...)
  // simply render no trend chart rather than a misleading empty one.
  const trendRows = report?.byDay || report?.salesByDay || [];

  // The first categorical (non-day-based) breakdown, charted as a
  // horizontal bar when it's small enough to read as a chart — By Branch,
  // Top Products, By Category, etc. Skips 'byDay'/'salesByDay' explicitly
  // since that data already renders as the trend line above; charting it
  // twice would just be the same numbers in two shapes.
  const chartBreakdown = useMemo(() => {
    const candidate = config.breakdowns.find(({ key }) => {
      if (key === 'byDay' || key === 'salesByDay') return false;
      const rows = report?.[key];
      return Array.isArray(rows) && rows.length > 0 && rows.length <= 10 && typeof rows[0]?.value === 'number';
    });
    return candidate ? { title: candidate.title, rows: report[candidate.key] } : null;
  }, [config, report]);

  const buildExportParams = () => {
    const params = {};
    config.filters.forEach((key) => {
      if (filters[key]) params[key] = filters[key];
    });
    return params;
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await reportService.exportReportPdf(reportType, buildExportParams(), config.label);
    } catch {
      setError('Failed to export PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await reportService.exportReportExcel(reportType, buildExportParams(), config.label);
    } catch {
      setError('Failed to export Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await reportService.exportReportCsv(reportType, buildExportParams(), config.label);
    } catch {
      setError('Failed to export CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  // Per-card "Quick Export" shortcut — exports the report type shown on
  // that card without first switching to it. For the currently-open type
  // it reuses the exact filters already applied; for any other type it
  // exports with no filters, which is the same as the backend's own
  // default ("this month so far") rather than an arbitrarily different
  // behavior for a report that was never opened.
  const quickExport = async (type, format) => {
    const cfg = REPORT_CONFIGS[type];
    const params = type === reportType ? buildExportParams() : {};
    try {
      if (format === 'pdf') await reportService.exportReportPdf(type, params, cfg.label);
      else if (format === 'excel') await reportService.exportReportExcel(type, params, cfg.label);
      else await reportService.exportReportCsv(type, params, cfg.label);
    } catch {
      setError(`Failed to export ${cfg.label}.`);
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-print-header">
        {company?.logo_path ? (
          <img src={company.logo_path} alt={company.company_name || 'Company logo'} className="reports-print-logo" />
        ) : (
          <span className="reports-print-mark">{company?.company_name || 'Clix'}</span>
        )}
        <span className="reports-print-name">{company?.company_name || 'Clix Sales System'}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Reports Center</h1>
          <p className="page-subtitle">Live reports generated directly from current data — no hardcoded values</p>
        </div>
        {canExport && (
          <div className="page-actions">
            <button type="button" className={`btn btn-secondary ${exportingPdf ? 'btn-loading' : ''}`} onClick={handleExportPdf} disabled={exportingPdf}>
              <FiFileText aria-hidden="true" /> PDF
            </button>
            <button type="button" className={`btn btn-secondary ${exportingExcel ? 'btn-loading' : ''}`} onClick={handleExportExcel} disabled={exportingExcel}>
              <FiGrid aria-hidden="true" /> Excel
            </button>
            <button type="button" className={`btn btn-secondary ${exportingCsv ? 'btn-loading' : ''}`} onClick={handleExportCsv} disabled={exportingCsv}>
              <FiDownload aria-hidden="true" /> CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              <FiPrinter aria-hidden="true" /> Print
            </button>
          </div>
        )}
      </div>

      <div className="reports-type-grid">
        {VISIBLE_REPORT_TYPES.map((key) => {
          const cfg = REPORT_CONFIGS[key];
          const Icon = REPORT_ICONS[key];
          const active = reportType === key;
          return (
            <div key={key} className={`card reports-type-card ${active ? 'reports-type-card-active' : ''}`}>
              <button type="button" className="reports-type-card-select" onClick={() => setReportType(key)}>
                <span className="reports-type-card-icon"><Icon aria-hidden="true" /></span>
                <span className="reports-type-card-title">{cfg.label}</span>
                <span className="reports-type-card-desc">{REPORT_DESCRIPTIONS[key]}</span>
              </button>
              {cfg.filters.includes('dateFrom') && (
                <select
                  className="form-control reports-type-card-date no-print"
                  aria-label={`${cfg.label} date range`}
                  value={active ? datePreset : 'month'}
                  onChange={(e) => { setReportType(key); applyDatePreset(e.target.value); }}
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="year">This Year</option>
                </select>
              )}
              {canExport && (
                <div className="reports-type-card-actions no-print">
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Export ${cfg.label} as PDF`} onClick={() => quickExport(key, 'pdf')}>
                    <FiFileText aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Export ${cfg.label} as Excel`} onClick={() => quickExport(key, 'excel')}>
                    <FiGrid aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Export ${cfg.label} as CSV`} onClick={() => quickExport(key, 'csv')}>
                    <FiDownload aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {config.filters.length > 0 && (
      <div className="card mb-5">
        <div className="card-body reports-filter-bar">
          {config.filters.includes('dateFrom') && (
            <div className="form-group">
              <label className="form-label" htmlFor="datePreset">Quick Range</label>
              <select id="datePreset" className="form-control" value={datePreset} onChange={(e) => applyDatePreset(e.target.value)}>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          )}
          {config.filters.includes('dateFrom') && (
            <div className="form-group">
              <label className="form-label" htmlFor="dateFrom">From</label>
              <input id="dateFrom" type="date" className="form-control" value={filters.dateFrom} onChange={(e) => { setDatePreset('custom'); setFilters((prev) => ({ ...prev, dateFrom: e.target.value })); }} />
            </div>
          )}
          {config.filters.includes('dateTo') && (
            <div className="form-group">
              <label className="form-label" htmlFor="dateTo">To</label>
              <input id="dateTo" type="date" className="form-control" value={filters.dateTo} onChange={(e) => { setDatePreset('custom'); setFilters((prev) => ({ ...prev, dateTo: e.target.value })); }} />
            </div>
          )}
          {config.filters.includes('branchId') && (
            <div className="form-group">
              <label className="form-label" htmlFor="branchId">Branch</label>
              <select id="branchId" className="form-control" value={filters.branchId} onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}>
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('cashierId') && canViewUsers && (
            <div className="form-group">
              <label className="form-label" htmlFor="cashierId">Cashier</label>
              <select id="cashierId" className="form-control" value={filters.cashierId} onChange={(e) => setFilters((prev) => ({ ...prev, cashierId: e.target.value }))}>
                <option value="">All Cashiers</option>
                {cashiers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('categoryId') && (
            <div className="form-group">
              <label className="form-label" htmlFor="categoryId">Category</label>
              <select id="categoryId" className="form-control" value={filters.categoryId} onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value }))}>
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('status') && (
            <div className="form-group">
              <label className="form-label" htmlFor="status">Status</label>
              <select id="status" className="form-control" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">All Statuses</option>
                {config.statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('customerId') && (
            <div className="form-group">
              <label className="form-label" htmlFor="customerId">Customer</label>
              <select id="customerId" className="form-control" value={filters.customerId} onChange={(e) => setFilters((prev) => ({ ...prev, customerId: e.target.value }))}>
                <option value="">All Customers</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('productId') && (
            <div className="form-group">
              <label className="form-label" htmlFor="productId">Product</label>
              <select id="productId" className="form-control" value={filters.productId} onChange={(e) => setFilters((prev) => ({ ...prev, productId: e.target.value }))}>
                <option value="">All Products</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
      )}

      {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-4 mb-5">
          {Array.from({ length: 4 }, (_, i) => `report-summary-skeleton-${i}`).map((skeletonKey) => (
            <div className="card kpi-card" key={skeletonKey}>
              <div style={{ width: '100%' }}>
                <Skeleton width="60%" height="0.8em" style={{ marginBottom: 'var(--space-2)' }} />
                <Skeleton width="40%" height="1.4em" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {summaryEntries.length > 0 && (
            <div className="grid grid-cols-4 mb-5">
              {summaryEntries.map((entry) => (
                <KPICard key={entry.key} label={entry.label} value={entry.value} formatter={MONEY_KEYS.has(entry.key) ? (v) => formatCurrency(v) : undefined} />
              ))}
            </div>
          )}

          {(trendRows.length > 0 || chartBreakdown) && (
            <div className={`grid mb-5 ${trendRows.length > 0 && chartBreakdown ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {trendRows.length > 0 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">{reportType === 'profit' ? 'Daily Profit Trend' : 'Sales Trend'}</span></div>
                  <div className="card-body">
                    <LineChart
                      labels={trendRows.map((r) => new Date(r.label).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' }))}
                      values={trendRows.map((r) => Number(r.value))}
                      valueFormatter={formatCurrency}
                    />
                  </div>
                </div>
              )}
              {chartBreakdown && (
                <div className="card">
                  <div className="card-header"><span className="card-title">{chartBreakdown.title}</span></div>
                  <div className="card-body">
                    <BarChart
                      labels={chartBreakdown.rows.map((r) => r.label)}
                      values={chartBreakdown.rows.map((r) => Number(r.value))}
                      valueFormatter={formatCurrency}
                      horizontal
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {report?.financialSummary && (
            <div className="card mb-5">
              <div className="card-header"><span className="card-title">Financial Summary</span></div>
              <div className="card-body">
                <dl className="reports-financial-summary">
                  <div><dt>Total Revenue</dt><dd>{formatCurrency(report.financialSummary.totalRevenue)}</dd></div>
                  <div><dt>Average Daily Sales</dt><dd>{formatCurrency(report.financialSummary.averageDailySales)}</dd></div>
                  {report.financialSummary.averageInvoice != null && (
                    <div><dt>Average Invoice</dt><dd>{formatCurrency(report.financialSummary.averageInvoice)}</dd></div>
                  )}
                  <div><dt>Highest Sales Day</dt><dd>{report.financialSummary.highestSalesDay.date} — {formatCurrency(report.financialSummary.highestSalesDay.value)}</dd></div>
                  <div><dt>Lowest Sales Day</dt><dd>{report.financialSummary.lowestSalesDay.date} — {formatCurrency(report.financialSummary.lowestSalesDay.value)}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {Array.isArray(report?.financialSummary?.monthlyTrend) && (
            <div className="card mb-5">
              <div className="card-header"><span className="card-title">Monthly Trend</span></div>
              <div className="card-body">
                <LineChart
                  labels={report.financialSummary.monthlyTrend.map((m) => m.month)}
                  values={report.financialSummary.monthlyTrend.map((m) => Number(m.value))}
                  valueFormatter={formatCurrency}
                />
              </div>
            </div>
          )}

          {Array.isArray(report?.analysis) && report.analysis.length > 0 && (
            <div className="card mb-5">
              <div className="card-header"><span className="card-title">Business Analysis</span></div>
              <div className="card-body">
                <ul className="reports-analysis-list">
                  {report.analysis.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
            </div>
          )}

          {Array.isArray(report?.recommendations) && report.recommendations.length > 0 && (
            <div className="card mb-5">
              <div className="card-header"><span className="card-title">Recommendations</span></div>
              <div className="card-body">
                <ul className="reports-recommendations-list">
                  {report.recommendations.map((line) => (
                    <li key={line}><FiTrendingUp aria-hidden="true" /> {line}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {config.breakdowns.map((breakdown) => (
            <BreakdownTable
              key={breakdown.key}
              title={breakdown.title}
              labelHeader={breakdown.labelHeader}
              rows={report?.[breakdown.key]}
              canExport={canExport}
              onExport={(title, rows) => downloadCsv(`${config.label}-${title}-${filters.dateFrom}-${filters.dateTo}`, rows)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportsCenter;
