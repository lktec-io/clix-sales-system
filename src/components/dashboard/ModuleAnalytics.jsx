import { useTranslation } from 'react-i18next';
import ChartCard from './ChartCard';
import BarChart from '../charts/BarChart';
import DoughnutChart from '../charts/DoughnutChart';
import { useAuth } from '../../hooks/useAuth';
import { useModules } from '../../hooks/useModules';
import { useReportLoader } from '../../hooks/useReportLoader';
import { availableBusinessReports } from '../../constants/businessReports';
import * as dashboardService from '../../services/dashboardService';
import * as medicineService from '../../services/medicineService';
import * as pharmacySaleService from '../../services/pharmacySaleService';
import * as restaurantOrderService from '../../services/restaurantOrderService';
import * as repairService from '../../services/repairService';
import * as loanService from '../../services/loanService';
import { fetchAllPages, presetRange, eachDay, toDayKey, inRange, sum } from '../../utils/reportData';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import styles from './ModuleAnalytics.module.css';

// Per-industry accent + doughnut palette — each module reads as its own
// product while sharing the Clix layout.
const MODULE_THEME = {
  // Palette roles: emerald = paid/checkout, blue = system, rose = alerts,
  // amber = pending/highlights, navy = structure.
  retail: { accent: '#047857', palette: ['#047857', '#2563EB', '#D97706', '#E11D48', '#0F172A', '#94A3B8'] },
  cosmetics: { accent: '#E11D48', palette: ['#E11D48', '#F43F5E', '#2563EB', '#D97706', '#0F172A', '#94A3B8'] },
  repair: { accent: '#2563EB', palette: ['#94A3B8', '#D97706', '#2563EB', '#0F172A', '#047857', '#E11D48'] },
  loans: { accent: '#D97706', palette: ['#2563EB', '#047857', '#E11D48', '#0F172A', '#D97706', '#94A3B8'] },
  pharmacy: { accent: '#047857', palette: ['#E11D48', '#D97706', '#2563EB', '#047857', '#94A3B8', '#CBD5E1'] },
  restaurant: { accent: '#D97706', palette: ['#D97706', '#F59E0B', '#2563EB', '#0F172A', '#047857', '#E11D48'] },
};

const useDayLabel = () => {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  return (day) => new Date(`${day}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};

// ---------------------------------------------------------------------------
// Retail & Cosmetics — month-by-month sales comparison.
// ---------------------------------------------------------------------------
function SalesAnalytics({ theme }) {
  const { t, i18n } = useTranslation('dashboard');
  const locale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const { data, loading } = useReportLoader(() => dashboardService.getChart('sales-trend', { range: 'year' }), []);
  const rows = data || [];
  const monthLabel = (value) => new Date(String(value).slice(0, 10)).toLocaleDateString(locale, { month: 'short', year: '2-digit' });

  return (
    <div className={styles.row}>
      <ChartCard title={t('moduleAnalytics.monthlySales')} loading={loading} empty={rows.length === 0}>
        <BarChart labels={rows.map((r) => monthLabel(r.date))} values={rows.map((r) => Number(r.value))} color={theme.accent} valueFormatter={formatCurrency} height={260} />
      </ChartCard>
      <ChartCard title={t('moduleAnalytics.monthlyReceipts')} loading={loading} empty={rows.length === 0}>
        <BarChart labels={rows.map((r) => monthLabel(r.date))} values={rows.map((r) => Number(r.count))} color={theme.palette[1]} valueFormatter={formatNumber} height={260} />
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pharmacy — expiry profile + last 7 days of dispensing.
// ---------------------------------------------------------------------------
function PharmacyAnalytics({ theme }) {
  const { t } = useTranslation(['dashboard', 'reports']);
  const dayLabel = useDayLabel();
  const week = presetRange('7d');

  const batches = useReportLoader(async () => {
    const { items } = await fetchAllPages(({ page, limit }) => medicineService.listExpiring({ page, limit }), { maxPages: 10 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = { expired: 0, d30: 0, d90: 0, later: 0 };
    items.forEach((b) => {
      const expiry = new Date(b.expiry_date);
      expiry.setHours(0, 0, 0, 0);
      const days = Math.round((expiry - today) / 86_400_000);
      if (days < 0) buckets.expired += 1;
      else if (days <= 30) buckets.d30 += 1;
      else if (days <= 90) buckets.d90 += 1;
      else buckets.later += 1;
    });
    return buckets;
  }, []);

  const sales = useReportLoader(
    () => fetchAllPages(({ page, limit }) => pharmacySaleService.listSales({ page, limit, dateFrom: week.from, dateTo: week.to })),
    [week.from, week.to],
  );

  const bucketData = batches.data
    ? [
      { label: t('reports:business.pharmacy.buckets.expired'), value: batches.data.expired },
      { label: t('reports:business.pharmacy.buckets.d30'), value: batches.data.d30 },
      { label: t('reports:business.pharmacy.buckets.d90'), value: batches.data.d90 },
      { label: t('dashboard:moduleAnalytics.over90'), value: batches.data.later },
    ]
    : [];
  const days = eachDay(week.from, week.to);
  const saleRows = (sales.data?.items || []).filter((s) => s.status !== 'voided');

  return (
    <div className={styles.row}>
      <ChartCard title={t('dashboard:moduleAnalytics.expiryProfile')} loading={batches.loading} empty={bucketData.every((b) => !b.value)}>
        <DoughnutChart data={bucketData} valueFormatter={formatNumber} colors={theme.palette} />
      </ChartCard>
      <ChartCard title={t('dashboard:moduleAnalytics.dispensingWeek')} loading={sales.loading} empty={saleRows.length === 0}>
        <BarChart
          labels={days.map(dayLabel)}
          values={days.map((day) => sum(saleRows.filter((s) => toDayKey(s.created_at) === day), (s) => s.total_amount))}
          color={theme.accent}
          valueFormatter={formatCurrency}
          height={260}
        />
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Restaurant — today's revenue by hour + live orders by status.
// ---------------------------------------------------------------------------
function RestaurantAnalytics({ theme }) {
  const { t } = useTranslation(['dashboard', 'restaurant']);
  const today = presetRange('today');
  const { data, loading } = useReportLoader(async () => {
    const { items } = await fetchAllPages(
      ({ page, limit }) => restaurantOrderService.listOrders({ page, limit }),
      { isBeforeRange: (row) => toDayKey(row.created_at) < today.from, maxPages: 10 },
    );
    return items.filter((row) => inRange(row.created_at, today.from, today.to));
  }, [today.from]);

  const orders = data || [];
  const settled = orders.filter((o) => ['paid', 'completed'].includes(o.status));
  const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= 7 && h <= 23);
  const statusCounts = ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'paid', 'completed', 'cancelled']
    .map((status) => ({ label: t(`restaurant:orders.status.${status}`), value: orders.filter((o) => o.status === status).length }))
    .filter((s) => s.value > 0);

  return (
    <div className={styles.row}>
      <ChartCard title={t('dashboard:moduleAnalytics.revenueByHour')} loading={loading} empty={settled.length === 0}>
        <BarChart
          labels={hours.map((h) => `${String(h).padStart(2, '0')}:00`)}
          values={hours.map((h) => sum(settled.filter((o) => new Date(o.created_at).getHours() === h), (o) => o.total_amount))}
          color={theme.accent}
          valueFormatter={formatCurrency}
          height={260}
        />
      </ChartCard>
      <ChartCard title={t('dashboard:moduleAnalytics.ordersByStatus')} loading={loading} empty={statusCounts.length === 0}>
        <DoughnutChart data={statusCounts} valueFormatter={formatNumber} colors={theme.palette} />
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone repair — jobs received per day + job pipeline (last 30 days).
// ---------------------------------------------------------------------------
const REPAIR_STAGES = [
  { key: 'received', statuses: ['received'] },
  { key: 'diagnosis', statuses: ['diagnosis', 'waiting_approval', 'approved'] },
  { key: 'repair', statuses: ['in_repair'] },
  { key: 'ready', statuses: ['ready_for_collection'] },
  { key: 'collected', statuses: ['completed'] },
];

function RepairAnalytics({ theme }) {
  const { t } = useTranslation(['dashboard', 'electronics']);
  const dayLabel = useDayLabel();
  const month = presetRange('30d');
  const fortnight = presetRange('7d');
  const { data, loading } = useReportLoader(
    () => fetchAllPages(({ page, limit }) => repairService.listRepairs({ page, limit, dateFrom: month.from, dateTo: month.to }), { maxPages: 10 }),
    [month.from],
  );
  const jobs = data?.items || [];
  const days = eachDay(fortnight.from, fortnight.to);
  const pipeline = REPAIR_STAGES
    .map((stage) => ({ label: t(`electronics:repairs.stepper.${stage.key}`), value: jobs.filter((j) => stage.statuses.includes(j.status)).length }))
    .filter((s) => s.value > 0);

  return (
    <div className={styles.row}>
      <ChartCard title={t('dashboard:moduleAnalytics.jobsPerDay')} loading={loading} empty={jobs.length === 0}>
        <BarChart
          labels={days.map(dayLabel)}
          values={days.map((day) => jobs.filter((j) => toDayKey(j.received_at) === day).length)}
          color={theme.accent}
          valueFormatter={formatNumber}
          height={260}
        />
      </ChartCard>
      <ChartCard title={t('dashboard:moduleAnalytics.repairPipeline')} loading={loading} empty={pipeline.length === 0}>
        <DoughnutChart data={pipeline} valueFormatter={formatNumber} colors={theme.palette} />
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Microfinance — portfolio by status + collections over the last 14 days.
// ---------------------------------------------------------------------------
function LoanAnalytics({ theme }) {
  const { t } = useTranslation(['dashboard', 'microfinance']);
  const dayLabel = useDayLabel();
  const window14 = presetRange('14d');

  const loans = useReportLoader(() => fetchAllPages(({ page, limit }) => loanService.listLoans({ page, limit }), { maxPages: 10 }), []);
  const repayments = useReportLoader(async () => {
    const { items } = await fetchAllPages(
      ({ page, limit }) => loanService.listRepayments({ page, limit }),
      { isBeforeRange: (row) => toDayKey(row.created_at) < window14.from, maxPages: 10 },
    );
    return items;
  }, [window14.from]);

  const statusMix = ['active', 'completed', 'defaulted', 'written_off', 'approved', 'submitted']
    .map((status) => ({ label: t(`microfinance:loans.status.${status}`), value: (loans.data?.items || []).filter((l) => l.status === status).length }))
    .filter((s) => s.value > 0);
  const days = eachDay(window14.from, window14.to);
  const payments = repayments.data || [];

  return (
    <div className={styles.row}>
      <ChartCard title={t('dashboard:moduleAnalytics.portfolioStatus')} loading={loans.loading} empty={statusMix.length === 0}>
        <DoughnutChart data={statusMix} valueFormatter={formatNumber} colors={theme.palette} />
      </ChartCard>
      <ChartCard title={t('dashboard:moduleAnalytics.collections')} loading={repayments.loading} empty={payments.length === 0}>
        <BarChart
          labels={days.map(dayLabel)}
          values={days.map((day) => sum(payments.filter((p) => toDayKey(p.payment_date || p.created_at) === day), (p) => p.amount))}
          color={theme.accent}
          valueFormatter={formatCurrency}
          height={260}
        />
      </ChartCard>
    </div>
  );
}

const RENDERERS = {
  retail: SalesAnalytics,
  cosmetics: SalesAnalytics,
  pharmacy: PharmacyAnalytics,
  restaurant: RestaurantAnalytics,
  repair: RepairAnalytics,
  loans: LoanAnalytics,
};

// Industry-specific analytics for each module this tenant runs, gated by
// the same module + permission rules as the business reports.
function ModuleAnalytics() {
  const { hasPermission } = useAuth();
  const { isModuleEnabled, businessTemplateSlug, loading } = useModules();
  if (loading) return null;
  const modules = availableBusinessReports({ isModuleEnabled, hasPermission, businessTemplateSlug });

  return modules.map(({ key }) => {
    const Renderer = RENDERERS[key];
    if (!Renderer) return null;
    const theme = MODULE_THEME[key];
    return (
      <section key={key} className={styles.module} style={{ '--module-accent': theme.accent }} data-module={key}>
        <Renderer theme={theme} />
      </section>
    );
  });
}

export default ModuleAnalytics;
