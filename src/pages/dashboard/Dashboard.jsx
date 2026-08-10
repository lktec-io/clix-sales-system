import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FiDollarSign, FiTrendingUp, FiShoppingBag, FiAlertTriangle, FiUserCheck, FiCreditCard, FiAlertOctagon,
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
    // by the 'loans'/'savings' modules' dashboard_widgets column
    // (028_create_microfinance_tables.sql). Only ever rendered for a tenant
    // whose resolved modules actually include them.
    { key: 'totalBorrowers', label: t('kpi.totalBorrowers'), icon: FiUserCheck, formatter: formatNumber, subtitle: t('kpi.totalBorrowersSubtitle'), accent: '#2F6BFF' },
    { key: 'activeLoans', label: t('kpi.activeLoans'), icon: FiCreditCard, formatter: formatNumber, subtitle: t('kpi.activeLoansSubtitle'), accent: '#10B981' },
    { key: 'outstandingBalance', label: t('kpi.outstandingBalance'), icon: FiDollarSign, formatter: formatCurrency, subtitle: t('kpi.outstandingBalanceSubtitle'), accent: '#8B5CF6' },
    { key: 'overdueLoans', label: t('kpi.overdueLoans'), icon: FiAlertOctagon, formatter: formatNumber, subtitle: t('kpi.overdueLoansSubtitle'), accent: '#EF4444' },
    { key: 'todayCollections', label: t('kpi.todayCollections'), icon: FiTrendingUp, formatter: formatCurrency, subtitle: t('kpi.todayCollectionsSubtitle'), accent: '#F59E0B' },
    { key: 'totalSavingsBalance', label: t('kpi.totalSavingsBalance'), icon: FiDollarSign, formatter: formatCurrency, subtitle: t('kpi.totalSavingsBalanceSubtitle'), accent: '#10B981' },
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
  const { hasWidget, loading: modulesLoading } = useModules();
  const KPI_DEFS = useKpiDefs(t).filter((def) => hasWidget(def.key));
  const enabledChartTypes = CHART_TYPES.filter((type) => hasWidget(CHART_TYPE_TO_WIDGET[type]));
  const showSalesTrend = hasWidget('salesTrend');
  const showLowStock = hasWidget('lowStockAlert');
  const chartColors = useChartTheme();
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState({});
  const [lowStockProducts, setLowStockProducts] = useState([]);
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
        const [lowStockResult] = await Promise.allSettled([
          showLowStock ? inventoryService.listInventory({ lowStock: true, limit: 10 }) : Promise.resolve({ items: [] }),
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

        <motion.div variants={STAGGER_ITEM}>
          <QuickActions />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Dashboard;
