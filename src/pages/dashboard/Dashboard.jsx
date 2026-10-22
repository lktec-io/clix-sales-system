import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FiDollarSign, FiTrendingUp, FiShoppingBag, FiAlertTriangle, FiUserCheck, FiCreditCard, FiAlertOctagon, FiClock, FiBox, FiCheckCircle, FiTool, FiPackage,
} from 'react-icons/fi';
import KPICard from '../../components/dashboard/KPICard';
import ChartCard from '../../components/dashboard/ChartCard';
import DashboardHero from '../../components/dashboard/DashboardHero';
import ModuleSwitcher from '../../components/dashboard/ModuleSwitcher';
import SubscriptionCard from '../../components/dashboard/SubscriptionCard';
import QuickActions from '../../components/dashboard/QuickActions';
import SalesTrendCard from '../../components/dashboard/SalesTrendCard';
import CustomerTrafficChart from '../../components/dashboard/CustomerTrafficChart';
import RecentSalesCard from '../../components/dashboard/RecentSalesCard';
import ModuleAnalytics from '../../components/dashboard/ModuleAnalytics';
import { useAuth } from '../../hooks/useAuth';
import TopProductsCard from '../../components/dashboard/TopProductsCard';
import LowStockAlertCard from '../../components/dashboard/LowStockAlertCard';
import DoughnutChart from '../../components/charts/DoughnutChart';
import BarChart from '../../components/charts/BarChart';
import { useChartTheme } from '../../components/charts/chartTheme';
import * as dashboardService from '../../services/dashboardService';
import * as inventoryService from '../../services/inventoryService';
import * as loanService from '../../services/loanService';
import * as medicineService from '../../services/medicineService';
import * as pharmacySaleService from '../../services/pharmacySaleService';
import * as restaurantOrderService from '../../services/restaurantOrderService';
import * as repairService from '../../services/repairService';
import { useModules } from '../../hooks/useModules';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import '../../styles/pages/Dashboard.css';

// The 5 KPI cards for this sprint's sales-motion-focused dashboard. Each
// accent is a distinct hue with no repeats.
function useKpiDefs(t) {
  return [
    { key: 'todaySales', label: t('kpi.todaySales'), icon: FiDollarSign, formatter: formatCurrency, subtitle: t('kpi.todaySalesSubtitle'), accent: '#10B981' },
    { key: 'monthlySales', label: t('kpi.monthlySales'), icon: FiTrendingUp, formatter: formatCurrency, subtitle: t('kpi.monthlySalesSubtitle'), accent: '#2F6BFF' },
    { key: 'monthlyProfit', label: t('kpi.monthlyProfit'), icon: FiTrendingUp, formatter: formatCurrency, subtitle: t('kpi.monthlyProfitSubtitle'), accent: '#8B5CF6' },
    { key: 'todayOrders', label: t('kpi.todayOrders'), icon: FiShoppingBag, formatter: formatNumber, subtitle: t('kpi.todayOrdersSubtitle'), accent: '#2563EB' },
    { key: 'lowStockCount', label: t('kpi.lowStockCount'), icon: FiAlertTriangle, formatter: formatNumber, subtitle: t('kpi.lowStockCountSubtitle'), accent: '#EF4444' },
    // Microfinance — same hasWidget() gate as every retail KPI above, driven
    // by the 'loans' module's dashboard_widgets column
    // (030_simplify_microfinance_loans.sql). Only ever rendered for a
    // tenant whose resolved modules actually include it — the exact 8
    // metrics a lending-focused dashboard needs to answer "how much have we
    // lent, collected, and what's still outstanding or overdue" at a glance.
    { key: 'totalLoans', label: t('kpi.totalLoans'), icon: FiCreditCard, formatter: formatNumber, subtitle: t('kpi.totalLoansSubtitle'), accent: '#64748B' },
    { key: 'activeLoans', label: t('kpi.activeLoans'), icon: FiUserCheck, formatter: formatNumber, subtitle: t('kpi.activeLoansSubtitle'), accent: '#2F6BFF' },
    { key: 'totalDisbursed', label: t('kpi.totalDisbursed'), icon: FiTrendingUp, formatter: formatCurrency, subtitle: t('kpi.totalDisbursedSubtitle'), accent: '#10B981' },
    { key: 'totalCollected', label: t('kpi.totalCollected'), icon: FiDollarSign, formatter: formatCurrency, subtitle: t('kpi.totalCollectedSubtitle'), accent: '#8B5CF6' },
    { key: 'outstandingBalance', label: t('kpi.outstandingBalance'), icon: FiClock, formatter: formatCurrency, subtitle: t('kpi.outstandingBalanceSubtitle'), accent: '#2563EB' },
    { key: 'overdueLoans', label: t('kpi.overdueLoans'), icon: FiAlertOctagon, formatter: formatNumber, subtitle: t('kpi.overdueLoansSubtitle'), accent: '#EF4444' },
    { key: 'portfolioAtRisk', label: t('kpi.portfolioAtRisk'), icon: FiAlertTriangle, formatter: formatCurrency, subtitle: t('kpi.portfolioAtRiskSubtitle'), accent: '#DC2626' },
    { key: 'todayCollections', label: t('kpi.todayCollections'), icon: FiTrendingUp, formatter: formatCurrency, subtitle: t('kpi.todayCollectionsSubtitle'), accent: '#06B6D4' },
    // Pharmacy — gated by the 'medicines' module's dashboard_widgets column
    // (031_create_pharmacy_tables.sql), same hasWidget() pattern as every
    // KPI above. lowStockCount/outOfStockCount are shared widget keys with
    // retail's own inventory KPIs by design (same underlying concept,
    // reused rather than duplicated) — never rendered together since the
    // two are mutually exclusive business templates.
    { key: 'totalMedicines', label: t('kpi.totalMedicines'), icon: FiBox, formatter: formatNumber, subtitle: t('kpi.totalMedicinesSubtitle'), accent: '#2F6BFF' },
    { key: 'outOfStockCount', label: t('kpi.outOfStockCount'), icon: FiAlertOctagon, formatter: formatNumber, subtitle: t('kpi.outOfStockCountSubtitle'), accent: '#DC2626' },
    { key: 'expiredCount', label: t('kpi.expiredCount'), icon: FiAlertTriangle, formatter: formatNumber, subtitle: t('kpi.expiredCountSubtitle'), accent: '#EF4444' },
    { key: 'expiringSoonCount', label: t('kpi.expiringSoonCount'), icon: FiClock, formatter: formatNumber, subtitle: t('kpi.expiringSoonCountSubtitle'), accent: '#2563EB' },
    { key: 'todaySalesCount', label: t('kpi.todaySalesCount'), icon: FiShoppingBag, formatter: formatNumber, subtitle: t('kpi.todaySalesCountSubtitle'), accent: '#8B5CF6' },
    { key: 'todayRevenue', label: t('kpi.todayRevenue'), icon: FiDollarSign, formatter: formatCurrency, subtitle: t('kpi.todayRevenueSubtitle'), accent: '#10B981' },
    { key: 'medicinesSoldCount', label: t('kpi.medicinesSoldCount'), icon: FiPackage, formatter: formatNumber, subtitle: t('kpi.medicinesSoldCountSubtitle'), accent: '#0D9488' },
    // Reuses the same "todayProfit" key retail's own KPI set already
    // computes (dashboard.repository.js#getKpis) — see the repository
    // comment in pharmacySale.repository.js#getSalesSummary for why sharing
    // this key is safe (Pharmacy/Retail are mutually exclusive templates).
    { key: 'todayProfit', label: t('kpi.todayProfit'), icon: FiTrendingUp, formatter: formatCurrency, subtitle: t('kpi.todayProfitSubtitle'), accent: '#059669' },
    // Restaurant — gated by the 'restaurant_orders'/'tables' modules'
    // dashboard_widgets columns (033_create_restaurant_tables.sql).
    // todaySales/todayOrders above are reused directly (same meaning as
    // retail's own definitions); only the Restaurant-unique concepts below
    // get new keys.
    { key: 'completedOrdersToday', label: t('kpi.completedOrdersToday'), icon: FiCheckCircle, formatter: formatNumber, subtitle: t('kpi.completedOrdersTodaySubtitle'), accent: '#10B981' },
    { key: 'pendingKitchenOrders', label: t('kpi.pendingKitchenOrders'), icon: FiClock, formatter: formatNumber, subtitle: t('kpi.pendingKitchenOrdersSubtitle'), accent: '#2563EB' },
    { key: 'occupiedTables', label: t('kpi.occupiedTables'), icon: FiUserCheck, formatter: formatNumber, subtitle: t('kpi.occupiedTablesSubtitle'), accent: '#EF4444' },
    { key: 'availableTables', label: t('kpi.availableTables'), icon: FiCheckCircle, formatter: formatNumber, subtitle: t('kpi.availableTablesSubtitle'), accent: '#2F6BFF' },
    // Electronics/Repairs — gated by the 'repairs' module's dashboard_widgets
    // column (034_finalize_template_scope_and_electronics_repairs.sql).
    { key: 'todayRepairs', label: t('kpi.todayRepairs'), icon: FiTool, formatter: formatNumber, subtitle: t('kpi.todayRepairsSubtitle'), accent: '#2F6BFF' },
    { key: 'pendingDiagnosis', label: t('kpi.pendingDiagnosis'), icon: FiClock, formatter: formatNumber, subtitle: t('kpi.pendingDiagnosisSubtitle'), accent: '#2563EB' },
    { key: 'waitingApproval', label: t('kpi.waitingApproval'), icon: FiAlertOctagon, formatter: formatNumber, subtitle: t('kpi.waitingApprovalSubtitle'), accent: '#DC2626' },
    { key: 'inRepairCount', label: t('kpi.inRepairCount'), icon: FiTool, formatter: formatNumber, subtitle: t('kpi.inRepairCountSubtitle'), accent: '#8B5CF6' },
    { key: 'readyForCollection', label: t('kpi.readyForCollection'), icon: FiCheckCircle, formatter: formatNumber, subtitle: t('kpi.readyForCollectionSubtitle'), accent: '#06B6D4' },
    { key: 'completedRepairsToday', label: t('kpi.completedRepairsToday'), icon: FiCheckCircle, formatter: formatNumber, subtitle: t('kpi.completedRepairsTodaySubtitle'), accent: '#10B981' },
    { key: 'outstandingRepairPayments', label: t('kpi.outstandingRepairPayments'), icon: FiDollarSign, formatter: formatCurrency, subtitle: t('kpi.outstandingRepairPaymentsSubtitle'), accent: '#EF4444' },
  ];
}

// Only the business-critical analytics for a sales system: how much came
// in (trend), what it cost against it (revenue vs expenses), how customers
// paid, what's selling, and what needs restocking. Branch performance,
// inventory breakdown donuts, a redundant "today" recap, a generic
// activity feed, and ops/infra status were all cut — this is meant to
// read in 3-5 seconds, not require scrolling through an audit log to find
// the numbers that matter.
const CHART_TYPES = ['top-products', 'payment-status', 'revenue-vs-expenses'];
// Maps each chart's service-call key to the dashboard_widgets entry that
// gates it in the module registry (026_create_module_framework_tables.sql)
// — camelCase widget keys vs. the kebab-case chart-type keys the existing
// /dashboard/charts/:type endpoint already used pre-Phase-5.
const CHART_TYPE_TO_WIDGET = {
  'top-products': 'topProducts',
  'payment-status': 'paymentStatus',
  'revenue-vs-expenses': 'revenueVsExpenses',
};

// KPIs with an honest day-over-day series (the retail sales-trend week),
// keyed to the series field that backs their trend chip and micro-chart.
const KPI_TRENDS = { todaySales: 'value', todayOrders: 'count' };

// Today's Sales is the one KPI with a real, honest day-over-day comparison
// readily available (the sales-trend series already includes yesterday) —
// every other card is left without a trend badge rather than fabricate one.
function computeTodayTrend(salesTrend, field = 'value') {
  if (!salesTrend || salesTrend.length < 2) return null;
  const today = Number(salesTrend[salesTrend.length - 1]?.[field]) || 0;
  const yesterday = Number(salesTrend[salesTrend.length - 2]?.[field]) || 0;
  if (yesterday === 0) return null;
  const percent = ((today - yesterday) / yesterday) * 100;
  return { percent, direction: percent >= 0 ? 'up' : 'down' };
}

function Dashboard() {
  const { t, i18n } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { hasWidget, isModuleEnabled, loading: modulesLoading } = useModules();
  const KPI_DEFS = useKpiDefs(t).filter((def) => hasWidget(def.key));
  const enabledChartTypes = CHART_TYPES.filter((type) => hasWidget(CHART_TYPE_TO_WIDGET[type]));
  const showSalesTrend = hasWidget('salesTrend');
  const showLowStock = hasWidget('lowStockAlert');
  const showLoanPortfolio = isModuleEnabled('loans');
  const showPharmacy = isModuleEnabled('medicines');
  const showRestaurant = isModuleEnabled('restaurant_orders');
  const showElectronics = isModuleEnabled('repairs');
  const { hasPermission } = useAuth();
  const showRecentSales = isModuleEnabled('sales') && hasPermission('sales.view');
  const chartColors = useChartTheme();
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState({});
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [recentLoans, setRecentLoans] = useState([]);
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentRepairs, setRecentRepairs] = useState([]);
  const [todayTrend, setTodayTrend] = useState(null);
  const [ordersTrend, setOrdersTrend] = useState(null);
  const [salesWeek, setSalesWeek] = useState([]);
  const [salesRange, setSalesRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Waits for the module list to resolve first — fetching before it does
    // would either skip every widget (empty enabled-set) or fetch data for
    // widgets this tenant's template doesn't include, wasting a request.
    if (modulesLoading) return undefined;

    let cancelled = false;

    async function load() {
      try {
        const [kpiResult, ...chartResults] = await Promise.all([
          dashboardService.getKpis(),
          ...enabledChartTypes.map((type) => dashboardService.getChart(type)),
          ...(showSalesTrend ? [dashboardService.getChart('sales-trend', { range: 'week' })] : []),
        ]);
        const [lowStockResult, recentLoansResult, expiringResult, recentSalesResult, recentOrdersResult, recentRepairsResult] = await Promise.allSettled([
          showLowStock ? inventoryService.listInventory({ lowStock: true, limit: 10 }) : Promise.resolve({ items: [] }),
          showLoanPortfolio ? loanService.getRecentApplications(5) : Promise.resolve([]),
          showPharmacy ? medicineService.listExpiring({ status: 'expiring_soon', limit: 5 }) : Promise.resolve({ items: [] }),
          showPharmacy ? pharmacySaleService.getRecentSales(5) : Promise.resolve([]),
          showRestaurant ? restaurantOrderService.getRecentOrders(5) : Promise.resolve([]),
          showElectronics ? repairService.getRecentRepairs(5) : Promise.resolve([]),
        ]);

        if (cancelled) return;

        setKpis(kpiResult);
        const chartMap = {};
        enabledChartTypes.forEach((type, index) => {
          chartMap[type] = chartResults[index];
        });
        setCharts(chartMap);
        const weekSeries = showSalesTrend ? chartResults[enabledChartTypes.length] || [] : [];
        setTodayTrend(showSalesTrend ? computeTodayTrend(weekSeries, 'value') : null);
        setOrdersTrend(showSalesTrend ? computeTodayTrend(weekSeries, 'count') : null);
        setSalesWeek(weekSeries);
        setLowStockProducts(lowStockResult.status === 'fulfilled' ? lowStockResult.value.items : []);
        setRecentLoans(recentLoansResult.status === 'fulfilled' ? recentLoansResult.value : []);
        setExpiringBatches(expiringResult.status === 'fulfilled' ? expiringResult.value.items : []);
        setRecentSales(recentSalesResult.status === 'fulfilled' ? recentSalesResult.value : []);
        setRecentOrders(recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : []);
        setRecentRepairs(recentRepairsResult.status === 'fulfilled' ? recentRepairsResult.value : []);
      } catch {
        if (!cancelled) setError(t('loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is only used inside the catch's error message; enabledChartTypes/showSalesTrend/showLowStock are derived from the module list, which only changes on login/logout, not worth re-running the fetch for
  }, [modulesLoading]);

  const topProducts = charts['top-products'] || [];
  const paymentStatus = charts['payment-status'] || [];
  const revenueVsExpenses = charts['revenue-vs-expenses'] || [];

  return (
    <div className="dashboard-page">
      <DashboardHero range={showSalesTrend ? salesRange : undefined} onRangeChange={showSalesTrend ? setSalesRange : undefined} />
      <ModuleSwitcher />

      {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}

      <div>
        <div>
          <SubscriptionCard />
        </div>

        <div className="kpi-grid">
          {KPI_DEFS.map(({ key, label, icon, formatter, subtitle, accent }) => (
            <div key={key}>
              <KPICard
                icon={icon}
                label={label}
                value={loading || !kpis ? 0 : kpis[key]}
                formatter={formatter}
                subtitle={subtitle}
                accent={accent}
                trend={KPI_TRENDS[key] ? { todaySales: todayTrend, todayOrders: ordersTrend }[key] : null}
                sparkline={KPI_TRENDS[key] && salesWeek.length >= 2 ? salesWeek.map((point) => Number(point[KPI_TRENDS[key]]) || 0) : undefined}
              />
            </div>
          ))}
        </div>

        {/* Industry-specific charts for this tenant's module(s). */}
        <ModuleAnalytics />

        {/* Middle row: circular summary on the left, sales line on the right. */}
        {(hasWidget('paymentStatus') || showSalesTrend) && (
          <div className="dashboard-analytics-row">
            {hasWidget('paymentStatus') && (
              <ChartCard title={t('charts.paymentStatus')} loading={loading} empty={paymentStatus.length === 0} emptyMessage={t('charts.noPayments')}>
                <DoughnutChart data={paymentStatus.map((p) => ({ label: p.name, value: Number(p.value) }))} valueFormatter={formatCurrency} />
              </ChartCard>
            )}
            {showSalesTrend && <SalesTrendCard range={salesRange} onRangeChange={setSalesRange} />}
          </div>
        )}

        {/* Bottom row: latest orders with status pills. */}
        {showRecentSales && (
          <div className="dashboard-table-row">
            <RecentSalesCard />
          </div>
        )}

        {showSalesTrend && (
          <div>
            <CustomerTrafficChart />
          </div>
        )}

        {hasWidget('revenueVsExpenses') && (
          <div className="dashboard-bottom-grid dashboard-bottom-grid-single">
            {hasWidget('revenueVsExpenses') && (
              <ChartCard title={t('charts.revenueVsExpenses')} loading={loading} empty={revenueVsExpenses.length === 0} emptyMessage={t('charts.noFinancialActivity')}>
                <BarChart
                  labels={revenueVsExpenses.map((d) => new Date(d.date).toLocaleDateString(i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ', { day: 'numeric', month: 'short' }))}
                  datasets={[
                    { label: t('charts.revenue'), values: revenueVsExpenses.map((d) => d.revenue), color: chartColors.success },
                    { label: t('charts.expenses'), values: revenueVsExpenses.map((d) => d.expenses), color: chartColors.danger },
                    { label: t('charts.profit'), values: revenueVsExpenses.map((d) => d.profit), color: chartColors.info },
                  ]}
                  valueFormatter={formatCurrency}
                  height={280}
                />
              </ChartCard>
            )}

          </div>
        )}

        {(hasWidget('topProducts') || showLowStock) && (
          <div className="dashboard-bottom-grid">
            {hasWidget('topProducts') && <TopProductsCard products={topProducts} loading={loading} />}
            {showLowStock && <LowStockAlertCard products={lowStockProducts} loading={loading} />}
          </div>
        )}

        {showLoanPortfolio && (
          <div className="dashboard-bottom-grid">
            <div className="card">
              <div className="card-header"><span className="card-title">{t('loanPortfolio.title')}</span></div>
              <div className="card-body loan-portfolio-breakdown">
                <div className="loan-portfolio-stat">
                  <span className="loan-portfolio-stat-value" style={{ color: '#2F6BFF' }}>{loading || !kpis ? '—' : formatNumber(kpis.activeLoans)}</span>
                  <span className="loan-portfolio-stat-label">{t('loanPortfolio.active')}</span>
                </div>
                <div className="loan-portfolio-stat">
                  <span className="loan-portfolio-stat-value" style={{ color: '#EF4444' }}>{loading || !kpis ? '—' : formatNumber(kpis.overdueLoans)}</span>
                  <span className="loan-portfolio-stat-label">{t('loanPortfolio.overdue')}</span>
                </div>
                <div className="loan-portfolio-stat">
                  <span className="loan-portfolio-stat-value" style={{ color: '#10B981' }}>{loading || !kpis ? '—' : formatNumber(kpis.completedLoans)}</span>
                  <span className="loan-portfolio-stat-label">{t('loanPortfolio.completed')}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">{t('recentLoans.title')}</span></div>
              {recentLoans.length === 0 ? (
                <div className="card-body text-sm text-secondary">{t('recentLoans.empty')}</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('recentLoans.customer')}</th>
                        <th>{t('recentLoans.amount')}</th>
                        <th>{t('recentLoans.date')}</th>
                        <th>{t('recentLoans.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLoans.map((loan) => (
                        <tr key={loan.id} className="table-row-clickable" onClick={() => navigate(`/loans/${loan.id}`)}>
                          <td>{loan.borrower_first_name} {loan.borrower_last_name}</td>
                          <td>{formatCurrency(loan.approved_amount || loan.requested_amount)}</td>
                          <td>{new Date(loan.created_at).toLocaleDateString(i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ', { day: 'numeric', month: 'short' })}</td>
                          <td><span className="badge badge-neutral">{t(`recentLoans.status_${loan.status}`, loan.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {showPharmacy && (
          <div className="dashboard-bottom-grid">
            <div className="card">
              <div className="card-header"><span className="card-title">{t('expiryAlerts.title')}</span></div>
              {expiringBatches.length === 0 ? (
                <div className="card-body text-sm text-secondary">{t('expiryAlerts.empty')}</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('expiryAlerts.medicine')}</th>
                        <th>{t('expiryAlerts.batch')}</th>
                        <th>{t('expiryAlerts.expiryDate')}</th>
                        <th>{t('expiryAlerts.quantity')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiringBatches.map((batch) => (
                        <tr key={batch.id} className="table-row-clickable" onClick={() => navigate('/expiry-tracking')}>
                          <td>{batch.medicine_name}</td>
                          <td>{batch.batch_number}</td>
                          <td>{new Date(batch.expiry_date).toLocaleDateString(i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td>{batch.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">{t('recentSales.title')}</span></div>
              {recentSales.length === 0 ? (
                <div className="card-body text-sm text-secondary">{t('recentSales.empty')}</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('recentSales.customer')}</th>
                        <th>{t('recentSales.amount')}</th>
                        <th>{t('recentSales.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((sale) => (
                        <tr key={sale.id} className="table-row-clickable" onClick={() => navigate(`/pharmacy/sales/${sale.id}`)}>
                          <td>{sale.customer_first_name ? `${sale.customer_first_name} ${sale.customer_last_name}` : t('recentSales.walkIn')}</td>
                          <td>{formatCurrency(sale.total_amount)}</td>
                          <td>{new Date(sale.created_at).toLocaleDateString(i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ', { day: 'numeric', month: 'short' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {showRestaurant && (
          <div className="dashboard-bottom-grid">
            <div className="card">
              <div className="card-header"><span className="card-title">{t('recentOrders.title')}</span></div>
              {recentOrders.length === 0 ? (
                <div className="card-body text-sm text-secondary">{t('recentOrders.empty')}</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('recentOrders.order')}</th>
                        <th>{t('recentOrders.table')}</th>
                        <th>{t('recentOrders.amount')}</th>
                        <th>{t('recentOrders.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="table-row-clickable" onClick={() => navigate(`/restaurant/orders/${order.id}`)}>
                          <td>{order.order_number}</td>
                          <td>{order.table_number || t('recentOrders.takeaway')}</td>
                          <td>{formatCurrency(order.total_amount)}</td>
                          <td><span className="badge badge-neutral">{t(`recentOrders.status_${order.status}`, order.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {showElectronics && (
          <div className="dashboard-bottom-grid">
            <div className="card">
              <div className="card-header"><span className="card-title">{t('recentRepairs.title')}</span></div>
              {recentRepairs.length === 0 ? (
                <div className="card-body text-sm text-secondary">{t('recentRepairs.empty')}</div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('recentRepairs.repairNumber')}</th>
                        <th>{t('recentRepairs.device')}</th>
                        <th>{t('recentRepairs.total')}</th>
                        <th>{t('recentRepairs.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRepairs.map((repair) => (
                        <tr key={repair.id} className="table-row-clickable" onClick={() => navigate(`/repairs/${repair.id}`)}>
                          <td>{repair.repair_number}</td>
                          <td>{repair.brand} {repair.model}</td>
                          <td>{formatCurrency(repair.repair_total)}</td>
                          <td><span className="badge badge-neutral">{t(`recentRepairs.status_${repair.status}`, repair.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
