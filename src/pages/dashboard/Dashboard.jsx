import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiDollarSign, FiTrendingUp, FiShoppingBag, FiAlertTriangle } from 'react-icons/fi';
import KPICard from '../../components/dashboard/KPICard';
import ChartCard from '../../components/dashboard/ChartCard';
import DashboardHero from '../../components/dashboard/DashboardHero';
import TrialCard from '../../components/dashboard/TrialCard';
import QuickActions from '../../components/dashboard/QuickActions';
import SalesTrendCard from '../../components/dashboard/SalesTrendCard';
import TopProductsCard from '../../components/dashboard/TopProductsCard';
import LowStockAlertCard from '../../components/dashboard/LowStockAlertCard';
import DoughnutChart from '../../components/charts/DoughnutChart';
import BarChart from '../../components/charts/BarChart';
import { useChartTheme } from '../../components/charts/chartTheme';
import * as dashboardService from '../../services/dashboardService';
import * as inventoryService from '../../services/inventoryService';
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
  const KPI_DEFS = useKpiDefs(t);
  const chartColors = useChartTheme();
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState({});
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [todayTrend, setTodayTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [kpiResult, ...chartResults] = await Promise.all([
          dashboardService.getKpis(),
          ...CHART_TYPES.map((type) => dashboardService.getChart(type)),
          dashboardService.getChart('sales-trend', { range: 'week' }),
        ]);
        const [lowStockResult] = await Promise.allSettled([
          inventoryService.listInventory({ lowStock: true, limit: 10 }),
        ]);

        if (cancelled) return;

        setKpis(kpiResult);
        const chartMap = {};
        CHART_TYPES.forEach((type, index) => {
          chartMap[type] = chartResults[index];
        });
        setCharts(chartMap);
        setTodayTrend(computeTodayTrend(chartResults[CHART_TYPES.length]));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is only used inside the catch's error message; including it would re-run this whole data fetch on every language switch
  }, []);

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

        <motion.div variants={STAGGER_ITEM}>
          <SalesTrendCard />
        </motion.div>

        <motion.div className="dashboard-bottom-grid" variants={STAGGER_ITEM}>
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

          <ChartCard title={t('charts.paymentStatus')} loading={loading} empty={paymentStatus.length === 0} emptyMessage={t('charts.noPayments')}>
            <DoughnutChart data={paymentStatus.map((p) => ({ label: p.name, value: Number(p.value) }))} valueFormatter={formatCurrency} />
          </ChartCard>
        </motion.div>

        <motion.div className="dashboard-bottom-grid" variants={STAGGER_ITEM}>
          <TopProductsCard products={topProducts} loading={loading} />
          <LowStockAlertCard products={lowStockProducts} loading={loading} />
        </motion.div>

        <motion.div variants={STAGGER_ITEM}>
          <QuickActions />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Dashboard;
