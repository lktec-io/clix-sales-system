import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FiDollarSign, FiTrendingUp, FiShoppingBag, FiAlertTriangle, FiUserCheck, FiCreditCard, FiAlertOctagon, FiClock, FiBox,
} from 'react-icons/fi';
import KPICard from '../../components/dashboard/KPICard';
import ChartCard from '../../components/dashboard/ChartCard';
import DashboardHero from '../../components/dashboard/DashboardHero';
import TrialCard from '../../components/dashboard/TrialCard';
import SubscriptionCard from '../../components/dashboard/SubscriptionCard';
import QuickActions from '../../components/dashboard/QuickActions';
import SalesTrendCard from '../../components/dashboard/SalesTrendCard';
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
    { key: 'todayOrders', label: t('kpi.todayOrders'), icon: FiShoppingBag, formatter: formatNumber, subtitle: t('kpi.todayOrdersSubtitle'), accent: '#F59E0B' },
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
    { key: 'outstandingBalance', label: t('kpi.outstandingBalance'), icon: FiClock, formatter: formatCurrency, subtitle: t('kpi.outstandingBalanceSubtitle'), accent: '#F59E0B' },
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
    { key: 'expiringSoonCount', label: t('kpi.expiringSoonCount'), icon: FiClock, formatter: formatNumber, subtitle: t('kpi.expiringSoonCountSubtitle'), accent: '#F59E0B' },
    { key: 'todaySalesCount', label: t('kpi.todaySalesCount'), icon: FiShoppingBag, formatter: formatNumber, subtitle: t('kpi.todaySalesCountSubtitle'), accent: '#8B5CF6' },
    { key: 'todayRevenue', label: t('kpi.todayRevenue'), icon: FiDollarSign, formatter: formatCurrency, subtitle: t('kpi.todayRevenueSubtitle'), accent: '#10B981' },
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

const STAGGER_CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const KPI_CARD_STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const KPI_CARD_ITEM = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

// Today's Sales is the one KPI with a real, honest day-over-day comparison
// readily available (the sales-trend series already includes yesterday) —
// every other card is left without a trend badge rather than fabricate one.
function computeTodayTrend(salesTrend) {
  if (!salesTrend || salesTrend.length < 2) return null;
  const today = Number(salesTrend[salesTrend.length - 1]?.value) || 0;
  const yesterday = Number(salesTrend[salesTrend.length - 2]?.value) || 0;
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
  const chartColors = useChartTheme();
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState({});
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [recentLoans, setRecentLoans] = useState([]);
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [todayTrend, setTodayTrend] = useState(null);
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
        const [lowStockResult, recentLoansResult, expiringResult, recentSalesResult] = await Promise.allSettled([
          showLowStock ? inventoryService.listInventory({ lowStock: true, limit: 10 }) : Promise.resolve({ items: [] }),
          showLoanPortfolio ? loanService.getRecentApplications(5) : Promise.resolve([]),
          showPharmacy ? medicineService.listExpiring({ status: 'expiring_soon', limit: 5 }) : Promise.resolve({ items: [] }),
          showPharmacy ? pharmacySaleService.getRecentSales(5) : Promise.resolve([]),
        ]);

        if (cancelled) return;

        setKpis(kpiResult);
        const chartMap = {};
        enabledChartTypes.forEach((type, index) => {
          chartMap[type] = chartResults[index];
        });
        setCharts(chartMap);
        setTodayTrend(showSalesTrend ? computeTodayTrend(chartResults[enabledChartTypes.length]) : null);
        setLowStockProducts(lowStockResult.status === 'fulfilled' ? lowStockResult.value.items : []);
        setRecentLoans(recentLoansResult.status === 'fulfilled' ? recentLoansResult.value : []);
        setExpiringBatches(expiringResult.status === 'fulfilled' ? expiringResult.value.items : []);
        setRecentSales(recentSalesResult.status === 'fulfilled' ? recentSalesResult.value : []);
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
    <div>
      <DashboardHero />

      {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}

      <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show">
        <motion.div variants={STAGGER_ITEM}>
          <TrialCard />
        </motion.div>

        <motion.div variants={STAGGER_ITEM}>
          <SubscriptionCard />
        </motion.div>

        <motion.div className="kpi-grid" variants={KPI_CARD_STAGGER}>
          {KPI_DEFS.map(({ key, label, icon, formatter, subtitle, accent }) => (
            <motion.div key={key} variants={KPI_CARD_ITEM}>
              <KPICard
                icon={icon}
                label={label}
                value={loading || !kpis ? 0 : kpis[key]}
                formatter={formatter}
                subtitle={subtitle}
                accent={accent}
                trend={key === 'todaySales' ? todayTrend : null}
              />
            </motion.div>
          ))}
        </motion.div>

        {showSalesTrend && (
          <motion.div variants={STAGGER_ITEM}>
            <SalesTrendCard />
          </motion.div>
        )}

        {(hasWidget('revenueVsExpenses') || hasWidget('paymentStatus')) && (
          <motion.div className="dashboard-bottom-grid" variants={STAGGER_ITEM}>
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

            {hasWidget('paymentStatus') && (
              <ChartCard title={t('charts.paymentStatus')} loading={loading} empty={paymentStatus.length === 0} emptyMessage={t('charts.noPayments')}>
                <DoughnutChart data={paymentStatus.map((p) => ({ label: p.name, value: Number(p.value) }))} valueFormatter={formatCurrency} />
              </ChartCard>
            )}
          </motion.div>
        )}

        {(hasWidget('topProducts') || showLowStock) && (
          <motion.div className="dashboard-bottom-grid" variants={STAGGER_ITEM}>
            {hasWidget('topProducts') && <TopProductsCard products={topProducts} loading={loading} />}
            {showLowStock && <LowStockAlertCard products={lowStockProducts} loading={loading} />}
          </motion.div>
        )}

        {showLoanPortfolio && (
          <motion.div className="dashboard-bottom-grid" variants={STAGGER_ITEM}>
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
          </motion.div>
        )}

        {showPharmacy && (
          <motion.div className="dashboard-bottom-grid" variants={STAGGER_ITEM}>
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
          </motion.div>
        )}

        <motion.div variants={STAGGER_ITEM}>
          <QuickActions />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Dashboard;
