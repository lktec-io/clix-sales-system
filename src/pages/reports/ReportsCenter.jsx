import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiPrinter, FiDownload, FiFileText, FiBarChart2, FiGrid, FiTrendingUp,
  FiDollarSign, FiPackage, FiBox, FiUsers, FiTruck, FiCreditCard, FiLayers, FiPercent, FiCheckCircle,
} from 'react-icons/fi';
import KPICard from '../../components/dashboard/KPICard';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import { usePermission } from '../../hooks/usePermission';
import { useCompany } from '../../hooks/useCompany';
import { useModules } from '../../hooks/useModules';
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

// Report type labels/summary labels/breakdown titles all come from the
// active i18n language, so this is a hook (called inside the component)
// rather than a module-level constant — same pattern as useKpiDefs(t) in
// Dashboard.jsx. Only the structural bits (keys, filter lists) stay fixed;
// every string value is resolved through t() at call time.
function usePurchaseStatusOptions(t) {
  return [
    { value: 'pending', label: t('reports:statusOptions.pending') },
    { value: 'received', label: t('reports:statusOptions.received') },
    { value: 'cancelled', label: t('reports:statusOptions.cancelled') },
  ];
}

function useReturnStatusOptions(t) {
  return [
    { value: 'pending', label: t('reports:statusOptions.pending') },
    { value: 'approved', label: t('reports:statusOptions.approved') },
    { value: 'rejected', label: t('reports:statusOptions.rejected') },
  ];
}

function useLoanStatusOptions(t) {
  return [
    { value: 'submitted', label: t('reports:loanStatusOptions.submitted') },
    { value: 'under_review', label: t('reports:loanStatusOptions.underReview') },
    { value: 'approved', label: t('reports:loanStatusOptions.approved') },
    { value: 'rejected', label: t('reports:loanStatusOptions.rejected') },
    { value: 'active', label: t('reports:loanStatusOptions.active') },
    { value: 'completed', label: t('reports:loanStatusOptions.completed') },
    { value: 'written_off', label: t('reports:loanStatusOptions.writtenOff') },
  ];
}

function useReportConfigs(t) {
  const purchaseStatusOptions = usePurchaseStatusOptions(t);
  const returnStatusOptions = useReturnStatusOptions(t);
  const loanStatusOptions = useLoanStatusOptions(t);

  return {
    sales: {
      label: t('reports:types.sales'), description: t('reports:descriptions.sales'),
      filters: ['dateFrom', 'dateTo', 'branchId', 'cashierId', 'customerId', 'productId'],
      summary: {
        totalSales: t('reports:summary.totalSales'), totalRevenue: t('reports:summary.totalRevenue'),
        totalDiscount: t('reports:summary.totalDiscount'), averageSale: t('reports:summary.averageSale'),
      },
      breakdowns: [
        { key: 'byDay', title: t('reports:breakdowns.byDay'), labelHeader: t('reports:headers.date') },
        { key: 'byBranch', title: t('reports:breakdowns.byBranch'), labelHeader: t('reports:headers.branch') },
      ],
    },
    suppliers: {
      label: t('reports:types.suppliers'), description: t('reports:descriptions.suppliers'), filters: [],
      breakdowns: [{ key: 'bySupplier', title: t('reports:breakdowns.supplierBalances'), labelHeader: t('reports:headers.supplier') }],
    },
    customers: {
      label: t('reports:types.customers'), description: t('reports:descriptions.customers'),
      filters: ['dateFrom', 'dateTo', 'branchId'],
      breakdowns: [{ key: 'topCustomers', title: t('reports:breakdowns.topCustomers'), labelHeader: t('reports:headers.customer') }],
    },
    inventory: {
      label: t('reports:types.inventory'), description: t('reports:descriptions.inventory'),
      filters: ['branchId', 'categoryId'],
      summary: {
        totalRecords: t('reports:summary.totalRecords'), totalValue: t('reports:summary.totalValue'),
        lowStock: t('reports:summary.lowStock'), outOfStock: t('reports:summary.outOfStock'),
      },
      breakdowns: [{ key: 'byCategory', title: t('reports:breakdowns.byCategory'), labelHeader: t('reports:headers.category') }],
    },
    products: {
      label: t('reports:types.products'), description: t('reports:descriptions.products'),
      filters: ['dateFrom', 'dateTo', 'branchId', 'categoryId'],
      breakdowns: [{ key: 'topProducts', title: t('reports:breakdowns.topProducts'), labelHeader: t('reports:headers.product') }],
    },
    purchases: {
      label: t('reports:types.purchases'), description: t('reports:descriptions.purchases'),
      filters: ['dateFrom', 'dateTo', 'branchId', 'status', 'productId'],
      statusOptions: purchaseStatusOptions,
      summary: { totalPurchases: t('reports:summary.totalPurchases'), totalAmount: t('reports:summary.totalAmount') },
      breakdowns: [{ key: 'bySupplier', title: t('reports:breakdowns.bySupplier'), labelHeader: t('reports:headers.supplier') }],
    },
    returns: {
      label: t('reports:types.returns'), description: t('reports:descriptions.returns'),
      filters: ['dateFrom', 'dateTo', 'branchId', 'status', 'customerId', 'productId'],
      statusOptions: returnStatusOptions,
      summary: { totalReturns: t('reports:summary.totalReturns'), totalRefund: t('reports:summary.totalRefund') },
      breakdowns: [{ key: 'byReason', title: t('reports:breakdowns.byReason'), labelHeader: t('reports:headers.reason') }],
    },
    expenses: {
      label: t('reports:types.expenses'), description: t('reports:descriptions.expenses'),
      filters: ['dateFrom', 'dateTo', 'branchId', 'categoryId'],
      summary: { totalExpenses: t('reports:summary.totalExpenses'), totalAmount: t('reports:summary.totalAmount') },
      breakdowns: [{ key: 'byCategory', title: t('reports:breakdowns.byCategory'), labelHeader: t('reports:headers.category') }],
    },
    profit: {
      label: t('reports:types.profit'), description: t('reports:descriptions.profit'),
      filters: ['dateFrom', 'dateTo', 'branchId'],
      summary: {
        salesRevenue: t('reports:summary.salesRevenue'), totalRevenue: t('reports:summary.totalRevenue'),
        cogs: t('reports:summary.cogs'), grossProfit: t('reports:summary.grossProfit'),
        expenses: t('reports:summary.expenses'), netProfit: t('reports:summary.netProfit'),
      },
      breakdowns: [{ key: 'byDay', title: t('reports:breakdowns.byDay'), labelHeader: t('reports:headers.date') }],
    },
    branches: {
      label: t('reports:types.branches'), description: t('reports:descriptions.branches'),
      filters: ['dateFrom', 'dateTo'],
      breakdowns: [{ key: 'byBranch', title: t('reports:breakdowns.branchComparison'), labelHeader: t('reports:headers.branch') }],
    },
    users: {
      label: t('reports:types.users'), description: t('reports:descriptions.users'),
      filters: ['dateFrom', 'dateTo', 'branchId'],
      summary: {
        totalUsers: t('reports:summary.totalUsers'), activeUsers: t('reports:summary.activeUsers'),
        suspendedUsers: t('reports:summary.suspendedUsers'), lockedUsers: t('reports:summary.lockedUsers'),
      },
      breakdowns: [
        { key: 'byRole', title: t('reports:breakdowns.byRole'), labelHeader: t('reports:headers.role') },
        { key: 'byBranch', title: t('reports:breakdowns.byBranch'), labelHeader: t('reports:headers.branch') },
      ],
    },
    loan_portfolio: {
      label: t('reports:types.loan_portfolio'), description: t('reports:descriptions.loan_portfolio'),
      filters: ['dateFrom', 'dateTo', 'branchId', 'status'],
      statusOptions: loanStatusOptions,
      summary: {
        totalLoans: t('reports:summary.totalLoans'), totalDisbursed: t('reports:summary.totalDisbursed'),
        totalOutstanding: t('reports:summary.totalOutstanding'),
      },
      breakdowns: [
        { key: 'byStatus', title: t('reports:breakdowns.byStatus'), labelHeader: t('reports:headers.status') },
        { key: 'byProduct', title: t('reports:breakdowns.byProduct'), labelHeader: t('reports:headers.product') },
      ],
    },
    loan_repayments: {
      label: t('reports:types.loan_repayments'), description: t('reports:descriptions.loan_repayments'),
      filters: ['dateFrom', 'dateTo', 'branchId'],
      summary: { totalRepayments: t('reports:summary.totalRepayments'), totalCollected: t('reports:summary.totalCollected') },
      breakdowns: [
        { key: 'byDay', title: t('reports:breakdowns.byDay'), labelHeader: t('reports:headers.date') },
        { key: 'byMethod', title: t('reports:breakdowns.byMethod'), labelHeader: t('reports:headers.method') },
      ],
    },
    // Combined business-summary report — backend/services/report.service.js's
    // buildAllReport() flattens Sales/Products/Customers/Expenses/Profit into
    // this exact shape, so it renders through the same summary cards +
    // BreakdownTable components every other report type already uses.
    // `analysis` is the one field that isn't a breakdown table — it's
    // rendered separately, right below the summary cards.
    all: {
      label: t('reports:types.all'), description: t('reports:descriptions.all'),
      filters: ['dateFrom', 'dateTo', 'branchId'],
      summary: {
        totalSales: t('reports:summary.totalSales'), totalRevenue: t('reports:summary.totalRevenue'),
        totalExpenses: t('reports:summary.totalExpenses'), netProfit: t('reports:summary.netProfit'),
      },
      breakdowns: [
        { key: 'salesByDay', title: t('reports:breakdowns.salesByDay'), labelHeader: t('reports:headers.date') },
        { key: 'salesByBranch', title: t('reports:breakdowns.salesByBranch'), labelHeader: t('reports:headers.branch') },
        { key: 'topProducts', title: t('reports:breakdowns.topProducts'), labelHeader: t('reports:headers.product') },
        { key: 'topCustomers', title: t('reports:breakdowns.topCustomers'), labelHeader: t('reports:headers.customer') },
        { key: 'expensesByCategory', title: t('reports:breakdowns.expensesByCategory'), labelHeader: t('reports:headers.category') },
      ],
    },
  };
}

// "Show only: Sales, Product, Inventory, Customer, Supplier, Expenses, All
// Reports" — the other REPORT_CONFIGS entries (purchases/returns/profit/
// branches/users) stay fully supported by the backend and this same
// generic renderer; they're just no longer offered as a card here, so
// nothing about how a report actually renders needed to change.
const VISIBLE_REPORT_TYPES = [
  'sales', 'products', 'inventory', 'customers', 'suppliers', 'expenses', 'all',
  'loan_portfolio', 'loan_repayments',
];

// A Business Template (School, Microfinance, ...) can reach this page with
// only a fraction of these business modules actually enabled — each card's
// underlying data source is one of these modules, so a card is only worth
// showing when its module is. 'all' is the combined Sales/Products/
// Customers/Expenses view, so it follows 'sales' (the module its summary
// and breakdowns are built around) rather than its own separate flag.
const REPORT_TYPE_MODULE_KEY = {
  sales: 'sales', products: 'products', inventory: 'inventory',
  // The "Customers" report is top-customers-by-SALES-spend, not a report
  // about the Customers module's existence — gated on 'sales' rather than
  // 'customers' so it doesn't show for a tenant (Microfinance) that has
  // Customers (borrowers are customers) but no Sales at all. Every existing
  // retail-shaped template already has both modules together, so this is a
  // no-op for them.
  customers: 'sales', suppliers: 'suppliers', expenses: 'expenses', all: 'sales',
  loan_portfolio: 'loans', loan_repayments: 'loan_repayments',
};

const REPORT_ICONS = {
  sales: FiDollarSign,
  products: FiPackage,
  inventory: FiBox,
  customers: FiUsers,
  suppliers: FiTruck,
  expenses: FiCreditCard,
  all: FiLayers,
  loan_portfolio: FiPercent,
  loan_repayments: FiCheckCircle,
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
  const { t } = useTranslation(['reports', 'common']);

  if (!rows || rows.length === 0) {
    return (
      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{title}</span></div>
        <div className="card-body">
          <EmptyState icon={FiBarChart2} title={t('reports:empty.title')} description={t('reports:empty.description')} />
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
  const { t, i18n } = useTranslation(['reports', 'common']);
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const REPORT_CONFIGS = useReportConfigs(t);
  const canExport = usePermission('reports.export');
  const canViewUsers = usePermission('users.view');
  const { company } = useCompany();
  const { isModuleEnabled, loading: modulesLoading } = useModules();
  const availableReportTypes = useMemo(
    () => VISIBLE_REPORT_TYPES.filter((type) => isModuleEnabled(REPORT_TYPE_MODULE_KEY[type])),
    [isModuleEnabled],
  );
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
    // Once the tenant's modules are known, the initial 'sales' guess may not
    // apply (e.g. a template with no Sales module) — switch to the first
    // card this tenant actually has, without fighting a selection the user
    // already made explicitly.
    if (modulesLoading) return;
    if (!availableReportTypes.includes(reportType) && availableReportTypes.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reconciling the initial 'sales' guess against the tenant's actual modules once they're known is synchronizing with an external system (ModuleContext), not derived render state
      setReportType(availableReportTypes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when modules finish loading or the available set changes, not on every reportType change (that would fight the user's own selection)
  }, [modulesLoading, availableReportTypes]);

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
      .catch(() => setError(t('reports:errors.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Skip fetching until modules are known and reportType has settled on
    // one this tenant actually has — otherwise this fires once for the
    // 'sales' guess (wasted request, possibly for a module-less tenant)
    // right before the effect above switches it.
    if (modulesLoading || !availableReportTypes.includes(reportType)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the selected report on filter/type change is standard data-fetching, not derived state
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config is derived from reportType, individual filter fields tracked explicitly below
  }, [reportType, modulesLoading, availableReportTypes, filters.dateFrom, filters.dateTo, filters.branchId, filters.categoryId, filters.status, filters.customerId, filters.productId, filters.cashierId]);

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
      setError(t('reports:errors.exportPdfFailed'));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await reportService.exportReportExcel(reportType, buildExportParams(), config.label);
    } catch {
      setError(t('reports:errors.exportExcelFailed'));
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await reportService.exportReportCsv(reportType, buildExportParams(), config.label);
    } catch {
      setError(t('reports:errors.exportCsvFailed'));
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
      setError(t('reports:errors.exportFailed', { type: cfg.label }));
    }
  };

  // A template with none of the report-backing modules enabled (e.g. a
  // sparse vertical whose only real module today is Reports itself) has
  // nothing honest to show yet — an empty state beats fake/irrelevant
  // Sales or Inventory cards with zero data behind them.
  if (!modulesLoading && availableReportTypes.length === 0) {
    return (
      <div className="reports-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('reports:page.title')}</h1>
            <p className="page-subtitle">{t('reports:page.subtitle')}</p>
          </div>
        </div>
        <EmptyState icon={FiBarChart2} title={t('reports:empty.title')} description={t('reports:empty.description')} />
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-print-header">
        {company?.logo_path ? (
          <img src={company.logo_path} alt={company.company_name || t('common:misc.companyLogo')} className="reports-print-logo" />
        ) : (
          <span className="reports-print-mark">{company?.company_name || 'Clix'}</span>
        )}
        <span className="reports-print-name">{company?.company_name || 'Clix Sales System'}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{t('reports:page.title')}</h1>
          <p className="page-subtitle">{t('reports:page.subtitle')}</p>
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
              <FiPrinter aria-hidden="true" /> {t('reports:actions.print')}
            </button>
          </div>
        )}
      </div>

      <div className="reports-type-grid">
        {availableReportTypes.map((key) => {
          const cfg = REPORT_CONFIGS[key];
          const Icon = REPORT_ICONS[key];
          const active = reportType === key;
          return (
            <div key={key} className={`card reports-type-card ${active ? 'reports-type-card-active' : ''}`}>
              <button type="button" className="reports-type-card-select" onClick={() => setReportType(key)}>
                <span className="reports-type-card-icon"><Icon aria-hidden="true" /></span>
                <span className="reports-type-card-title">{cfg.label}</span>
                <span className="reports-type-card-desc">{cfg.description}</span>
              </button>
              {cfg.filters.includes('dateFrom') && (
                <select
                  className="form-control reports-type-card-date no-print"
                  aria-label={t('reports:actions.dateRangeLabel', { type: cfg.label })}
                  value={active ? datePreset : 'month'}
                  onChange={(e) => { setReportType(key); applyDatePreset(e.target.value); }}
                >
                  <option value="today">{t('reports:presets.today')}</option>
                  <option value="week">{t('reports:presets.week')}</option>
                  <option value="month">{t('reports:presets.month')}</option>
                  <option value="lastMonth">{t('reports:presets.lastMonth')}</option>
                  <option value="year">{t('reports:presets.year')}</option>
                </select>
              )}
              {canExport && (
                <div className="reports-type-card-actions no-print">
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t('reports:actions.exportPdfLabel', { type: cfg.label })} onClick={() => quickExport(key, 'pdf')}>
                    <FiFileText aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t('reports:actions.exportExcelLabel', { type: cfg.label })} onClick={() => quickExport(key, 'excel')}>
                    <FiGrid aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t('reports:actions.exportCsvLabel', { type: cfg.label })} onClick={() => quickExport(key, 'csv')}>
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
              <label className="form-label" htmlFor="datePreset">{t('reports:filters.quickRange')}</label>
              <select id="datePreset" className="form-control" value={datePreset} onChange={(e) => applyDatePreset(e.target.value)}>
                <option value="today">{t('reports:presets.today')}</option>
                <option value="yesterday">{t('reports:presets.yesterday')}</option>
                <option value="last7">{t('reports:presets.last7')}</option>
                <option value="last30">{t('reports:presets.last30')}</option>
                <option value="week">{t('reports:presets.week')}</option>
                <option value="month">{t('reports:presets.month')}</option>
                <option value="lastMonth">{t('reports:presets.lastMonth')}</option>
                <option value="year">{t('reports:presets.year')}</option>
                <option value="custom">{t('reports:presets.custom')}</option>
              </select>
            </div>
          )}
          {config.filters.includes('dateFrom') && (
            <div className="form-group">
              <label className="form-label" htmlFor="dateFrom">{t('reports:filters.from')}</label>
              <input id="dateFrom" type="date" className="form-control" value={filters.dateFrom} onChange={(e) => { setDatePreset('custom'); setFilters((prev) => ({ ...prev, dateFrom: e.target.value })); }} />
            </div>
          )}
          {config.filters.includes('dateTo') && (
            <div className="form-group">
              <label className="form-label" htmlFor="dateTo">{t('reports:filters.to')}</label>
              <input id="dateTo" type="date" className="form-control" value={filters.dateTo} onChange={(e) => { setDatePreset('custom'); setFilters((prev) => ({ ...prev, dateTo: e.target.value })); }} />
            </div>
          )}
          {config.filters.includes('branchId') && (
            <div className="form-group">
              <label className="form-label" htmlFor="branchId">{t('common:labels.branch')}</label>
              <select id="branchId" className="form-control" value={filters.branchId} onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}>
                <option value="">{t('common:labels.allBranches')}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('cashierId') && canViewUsers && (
            <div className="form-group">
              <label className="form-label" htmlFor="cashierId">{t('reports:filters.cashier')}</label>
              <select id="cashierId" className="form-control" value={filters.cashierId} onChange={(e) => setFilters((prev) => ({ ...prev, cashierId: e.target.value }))}>
                <option value="">{t('reports:filters.allCashiers')}</option>
                {cashiers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('categoryId') && (
            <div className="form-group">
              <label className="form-label" htmlFor="categoryId">{t('reports:filters.category')}</label>
              <select id="categoryId" className="form-control" value={filters.categoryId} onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value }))}>
                <option value="">{t('reports:filters.allCategories')}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('status') && (
            <div className="form-group">
              <label className="form-label" htmlFor="status">{t('common:labels.status')}</label>
              <select id="status" className="form-control" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">{t('reports:filters.allStatuses')}</option>
                {config.statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('customerId') && (
            <div className="form-group">
              <label className="form-label" htmlFor="customerId">{t('reports:filters.customer')}</label>
              <select id="customerId" className="form-control" value={filters.customerId} onChange={(e) => setFilters((prev) => ({ ...prev, customerId: e.target.value }))}>
                <option value="">{t('reports:filters.allCustomers')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          )}
          {config.filters.includes('productId') && (
            <div className="form-group">
              <label className="form-label" htmlFor="productId">{t('reports:filters.product')}</label>
              <select id="productId" className="form-control" value={filters.productId} onChange={(e) => setFilters((prev) => ({ ...prev, productId: e.target.value }))}>
                <option value="">{t('reports:filters.allProducts')}</option>
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
                  <div className="card-header"><span className="card-title">{reportType === 'profit' ? t('reports:charts.dailyProfitTrend') : t('reports:charts.salesTrend')}</span></div>
                  <div className="card-body">
                    <LineChart
                      labels={trendRows.map((r) => new Date(r.label).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' }))}
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
              <div className="card-header"><span className="card-title">{t('reports:financialSummary.title')}</span></div>
              <div className="card-body">
                <dl className="reports-financial-summary">
                  <div><dt>{t('reports:financialSummary.totalRevenue')}</dt><dd>{formatCurrency(report.financialSummary.totalRevenue)}</dd></div>
                  <div><dt>{t('reports:financialSummary.averageDailySales')}</dt><dd>{formatCurrency(report.financialSummary.averageDailySales)}</dd></div>
                  {report.financialSummary.averageInvoice != null && (
                    <div><dt>{t('reports:financialSummary.averageInvoice')}</dt><dd>{formatCurrency(report.financialSummary.averageInvoice)}</dd></div>
                  )}
                  <div><dt>{t('reports:financialSummary.highestSalesDay')}</dt><dd>{report.financialSummary.highestSalesDay.date} — {formatCurrency(report.financialSummary.highestSalesDay.value)}</dd></div>
                  <div><dt>{t('reports:financialSummary.lowestSalesDay')}</dt><dd>{report.financialSummary.lowestSalesDay.date} — {formatCurrency(report.financialSummary.lowestSalesDay.value)}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {Array.isArray(report?.financialSummary?.monthlyTrend) && (
            <div className="card mb-5">
              <div className="card-header"><span className="card-title">{t('reports:financialSummary.monthlyTrend')}</span></div>
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
              <div className="card-header"><span className="card-title">{t('reports:analysis.title')}</span></div>
              <div className="card-body">
                <ul className="reports-analysis-list">
                  {report.analysis.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
            </div>
          )}

          {Array.isArray(report?.recommendations) && report.recommendations.length > 0 && (
            <div className="card mb-5">
              <div className="card-header"><span className="card-title">{t('reports:recommendations.title')}</span></div>
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
