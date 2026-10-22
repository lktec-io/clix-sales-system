import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlusSquare } from 'react-icons/fi';
import { ReportShell, ReportSection, ReportGrid, ReportTable, BarList } from './ReportShell';
import * as medicineService from '../../services/medicineService';
import * as pharmacySaleService from '../../services/pharmacySaleService';
import { useReportLoader } from '../../hooks/useReportLoader';
import { fetchAllPages, eachDay, toDayKey, presetRange, sum, groupBy, percent } from '../../utils/reportData';
import { downloadCsv } from '../../utils/exportCsv';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import styles from './ModuleReports.module.css';

// Expiry buckets by days remaining (negative = already expired).
const BUCKETS = [
  { key: 'expired', test: (d) => d < 0, tone: 'negative', badge: 'badge-danger' },
  { key: 'd30', test: (d) => d >= 0 && d <= 30, tone: 'negative', badge: 'badge-danger' },
  { key: 'd90', test: (d) => d > 30 && d <= 90, tone: 'warning', badge: 'badge-warning' },
  { key: 'd180', test: (d) => d > 90 && d <= 180, tone: 'neutral', badge: 'badge-info' },
  { key: 'later', test: (d) => d > 180, tone: 'positive', badge: 'badge-success' },
];

function bucketOf(days) {
  return BUCKETS.find((b) => b.test(days)) || BUCKETS[BUCKETS.length - 1];
}

// Batch & drug-expiry summary (every in-stock batch, from GET
// /medicines/expiring) plus dispensing sales for the selected dates (GET
// /pharmacy/sales filters by date server-side).
function PharmacyReport() {
  const { t, i18n } = useTranslation(['reports', 'pharmacy']);
  const navigate = useNavigate();
  const [range, setRange] = useState(() => presetRange('30d'));
  const [bucketFilter, setBucketFilter] = useState('');
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';

  const batches = useReportLoader(async () => {
    const { items, truncated } = await fetchAllPages(
      ({ page, limit }) => medicineService.listExpiring({ page, limit }),
      { maxPages: 30 },
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = items.map((b) => {
      const expiry = new Date(b.expiry_date);
      expiry.setHours(0, 0, 0, 0);
      const days = Math.round((expiry - today) / 86_400_000);
      return {
        key: b.id,
        id: b.id,
        medicineId: b.medicine_id,
        medicine: b.medicine_name,
        batch: b.batch_number,
        branch: b.branch_name,
        quantity: Number(b.quantity) || 0,
        value: (Number(b.quantity) || 0) * (Number(b.buying_price) || 0),
        expiry: b.expiry_date,
        days,
        bucket: bucketOf(days).key,
      };
    }).sort((a, b) => a.days - b.days);
    return { rows, truncated };
  }, []);

  const sales = useReportLoader(
    () => fetchAllPages(({ page, limit }) => pharmacySaleService.listSales({ page, limit, dateFrom: range.from, dateTo: range.to })),
    [range.from, range.to],
  );

  const stock = useMemo(() => {
    const rows = batches.data?.rows || [];
    const buckets = BUCKETS.map((bucket) => {
      const inBucket = rows.filter((r) => r.bucket === bucket.key);
      return {
        key: bucket.key,
        label: t(`reports:business.pharmacy.buckets.${bucket.key}`),
        batches: inBucket.length,
        units: sum(inBucket, (r) => r.quantity),
        value: sum(inBucket, (r) => r.value),
        tone: bucket.tone,
      };
    });
    const atRisk = rows.filter((r) => r.days <= 30);
    return {
      rows,
      buckets,
      totalValue: sum(rows, (r) => r.value),
      atRiskValue: sum(atRisk, (r) => r.value),
      expired: rows.filter((r) => r.days < 0).length,
      expiringSoon: rows.filter((r) => r.days >= 0 && r.days <= 30).length,
      filtered: bucketFilter ? rows.filter((r) => r.bucket === bucketFilter) : rows,
    };
  }, [batches.data, bucketFilter, t]);

  const dispensing = useMemo(() => {
    const rows = (sales.data?.items || []).filter((s) => s.status !== 'voided');
    const revenue = sum(rows, (s) => s.total_amount);
    return {
      rows,
      revenue,
      average: rows.length ? revenue / rows.length : 0,
      daily: eachDay(range.from, range.to).map((day) => {
        const dayRows = rows.filter((s) => toDayKey(s.created_at) === day);
        return { key: day, day, sales: dayRows.length, revenue: sum(dayRows, (s) => s.total_amount) };
      }).filter((d) => d.sales > 0),
      payments: groupBy(
        rows,
        (s) => s.payment_method || 'other',
        (key) => ({ key, method: key, sales: 0, revenue: 0 }),
        (acc, s) => { acc.sales += 1; acc.revenue += Number(s.total_amount) || 0; },
      ).sort((a, b) => b.revenue - a.revenue),
    };
  }, [sales.data, range.from, range.to]);

  const formatDate = (iso) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  const formatDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' });
  const daysLabel = (days) => (days < 0 ? t('reports:business.pharmacy.expiredAgo', { count: Math.abs(days) }) : t('reports:business.pharmacy.daysLeft', { count: days }));

  const exportCsv = () => downloadCsv('pharmacy-batches', stock.rows.map((r) => ({
    medicine: r.medicine, batch: r.batch, branch: r.branch, quantity: r.quantity, expiry: toDayKey(r.expiry), days_left: r.days, stock_value: r.value,
  })));

  return (
    <ReportShell
      title={t('reports:business.pharmacy.title')}
      subtitle={t('reports:business.pharmacy.subtitle')}
      icon={FiPlusSquare}
      range={range}
      onRangeChange={setRange}
      onRefresh={() => { batches.reload(); sales.reload(); }}
      onExport={exportCsv}
      loading={batches.loading}
      error={batches.error || sales.error}
      notice={batches.data?.truncated || sales.data?.truncated ? t('reports:business.truncated') : null}
      stats={[
        { label: t('reports:business.pharmacy.batches'), value: formatNumber(stock.rows.length), hint: formatCurrency(stock.totalValue) },
        { label: t('reports:business.pharmacy.expired'), value: formatNumber(stock.expired), tone: stock.expired ? 'negative' : 'positive' },
        { label: t('reports:business.pharmacy.expiringSoon'), value: formatNumber(stock.expiringSoon), tone: stock.expiringSoon ? 'warning' : undefined },
        { label: t('reports:business.pharmacy.valueAtRisk'), value: formatCurrency(stock.atRiskValue), tone: stock.atRiskValue ? 'negative' : undefined },
        { label: t('reports:business.pharmacy.dispensed'), value: formatCurrency(dispensing.revenue), hint: t('reports:business.pharmacy.salesCount', { count: dispensing.rows.length }) },
      ]}
    >
      <ReportGrid>
        <ReportSection title={t('reports:business.pharmacy.expiryProfile')}>
          <BarList items={stock.buckets.map((b) => ({ label: b.label, value: b.batches, tone: b.tone }))} formatValue={formatNumber} />
        </ReportSection>

        <ReportSection title={t('reports:business.pharmacy.bucketValue')}>
          <ReportTable
            loading={batches.loading}
            rows={stock.buckets}
            columns={[
              { key: 'label', label: t('reports:business.pharmacy.window') },
              { key: 'batches', label: t('reports:business.pharmacy.batches'), numeric: true, render: (r) => formatNumber(r.batches) },
              { key: 'units', label: t('reports:business.units'), numeric: true, render: (r) => formatNumber(r.units) },
              { key: 'value', label: t('reports:business.stockValue'), numeric: true, render: (r) => formatCurrency(r.value) },
            ]}
            footer={{
              label: t('reports:business.total'),
              batches: formatNumber(stock.rows.length),
              units: formatNumber(sum(stock.rows, (r) => r.quantity)),
              value: formatCurrency(stock.totalValue),
            }}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.pharmacy.batchRegister')} wide>
          <div className={styles.filterBar}>
            <span className={styles.filterLabel}>{t('reports:business.pharmacy.window')}</span>
            <div className={styles.pills} role="group" aria-label={t('reports:business.pharmacy.window')}>
              <button type="button" className={styles.pill} aria-pressed={bucketFilter === ''} onClick={() => setBucketFilter('')}>{t('reports:business.all')}</button>
              {BUCKETS.map((b) => (
                <button key={b.key} type="button" className={styles.pill} aria-pressed={bucketFilter === b.key} onClick={() => setBucketFilter(b.key)}>
                  {t(`reports:business.pharmacy.buckets.${b.key}`)}
                </button>
              ))}
            </div>
          </div>
          <ReportTable
            loading={batches.loading}
            rows={stock.filtered}
            maxRows={150}
            columns={[
              { key: 'medicine', label: t('reports:business.pharmacy.medicine'), render: (r) => <button type="button" className={styles.linkCell} onClick={() => navigate(`/medicines/${r.medicineId}`)}>{r.medicine}</button> },
              { key: 'batch', label: t('reports:business.pharmacy.batch'), render: (r) => <span className={styles.mono}>{r.batch}</span> },
              { key: 'branch', label: t('reports:business.branch') },
              { key: 'quantity', label: t('reports:business.units'), numeric: true, render: (r) => formatNumber(r.quantity) },
              { key: 'expiry', label: t('reports:business.pharmacy.expiry'), render: (r) => <span className={styles.mono}>{formatDate(r.expiry)}</span> },
              { key: 'days', label: t('reports:business.pharmacy.remaining'), render: (r) => <span className={`badge ${bucketOf(r.days).badge}`}>{daysLabel(r.days)}</span> },
              { key: 'value', label: t('reports:business.stockValue'), numeric: true, render: (r) => formatCurrency(r.value) },
            ]}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.pharmacy.dailyDispensing')}>
          <ReportTable
            loading={sales.loading}
            rows={dispensing.daily}
            columns={[
              { key: 'day', label: t('reports:business.date'), render: (r) => formatDay(r.day) },
              { key: 'sales', label: t('reports:business.pharmacy.sales'), numeric: true, render: (r) => formatNumber(r.sales) },
              { key: 'revenue', label: t('reports:business.stats.revenue'), numeric: true, render: (r) => formatCurrency(r.revenue) },
            ]}
            footer={{ day: t('reports:business.total'), sales: formatNumber(dispensing.rows.length), revenue: formatCurrency(dispensing.revenue) }}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.paymentMethod')}>
          <ReportTable
            loading={sales.loading}
            rows={dispensing.payments}
            columns={[
              { key: 'method', label: t('reports:business.paymentMethod'), render: (r) => t(`reports:business.payment.${r.method}`, { defaultValue: r.method }) },
              { key: 'sales', label: t('reports:business.pharmacy.sales'), numeric: true, render: (r) => formatNumber(r.sales) },
              { key: 'share', label: t('reports:business.share'), numeric: true, render: (r) => `${percent(r.revenue, dispensing.revenue).toFixed(1)}%` },
              { key: 'revenue', label: t('reports:business.stats.revenue'), numeric: true, render: (r) => formatCurrency(r.revenue) },
            ]}
          />
        </ReportSection>
      </ReportGrid>
    </ReportShell>
  );
}

export default PharmacyReport;
