import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { FiArrowDownRight, FiArrowUpRight, FiMinus } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useModules } from '../../hooks/useModules';
import * as dashboardService from '../../services/dashboardService';
import * as saleService from '../../services/saleService';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import styles from './CustomerTrafficChart.module.css';

const cx = (...classNames) => classNames.filter(Boolean).join(' ');

const HOURS = 24;
const REFRESH_MS = 60_000;
const SALES_PAGE_LIMIT = 100; // backend caps /sales at 100 per page
const MAX_SALES_PAGES = 15;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 19;

const compactAmount = new Intl.NumberFormat('en-TZ', { notation: 'compact', maximumFractionDigits: 1 });

// ---------------------------------------------------------------------------
// Data
//
// Today comes from the authoritative hourly aggregate
// (GET /dashboard/charts/sales-trend?range=today). The backend exposes no
// hourly series for yesterday, so it is bucketed client-side from the
// newest-first completed-sales list — paged once per day and cached, so the
// one-minute refresh only re-reads today's aggregate.
// ---------------------------------------------------------------------------

const emptyBuckets = () => Array.from({ length: HOURS }, () => ({ value: 0, count: 0 }));

const pad2 = (number) => String(number).padStart(2, '0');

function toDayKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfDay(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function bucketsFromTrend(rows) {
  const buckets = emptyBuckets();
  (rows || []).forEach((row) => {
    const hour = typeof row.date === 'string' ? Number(row.date.slice(11, 13)) : new Date(row.date).getHours();
    if (Number.isInteger(hour) && hour >= 0 && hour < HOURS) {
      buckets[hour] = { value: Number(row.value) || 0, count: Number(row.count) || 0 };
    }
  });
  return buckets;
}

// Keyed by user + calendar day: yesterday never changes once it is over,
// and a different user in the same tab must never see another's cache.
const yesterdayCache = new Map();

async function loadYesterdayBuckets(cacheKey, yesterdayStart, todayStart) {
  const cached = yesterdayCache.get(cacheKey);
  if (cached) return cached;

  const buckets = emptyBuckets();
  let truncated = false;

  for (let page = 1; ; page += 1) {
    const { items = [], meta } = await saleService.listSales({ status: 'completed', page, limit: SALES_PAGE_LIMIT });
    let reachedOlder = false;

    for (const sale of items) {
      const createdAt = new Date(sale.created_at);
      if (Number.isNaN(createdAt.getTime())) continue;
      if (createdAt < yesterdayStart) {
        reachedOlder = true;
        break;
      }
      if (createdAt < todayStart) {
        const bucket = buckets[createdAt.getHours()];
        bucket.value += Number(sale.total_amount) || 0;
        bucket.count += 1;
      }
    }

    const lastPage = meta?.totalPages ?? page;
    if (reachedOlder || items.length < SALES_PAGE_LIMIT || page >= lastPage) break;
    if (page >= MAX_SALES_PAGES) {
      truncated = true;
      break;
    }
  }

  const result = { buckets, truncated };
  yesterdayCache.set(cacheKey, result);
  return result;
}

function useLiveTraffic({ enabled, canCompare, userId }) {
  const [state, setState] = useState({ status: 'loading', today: null, yesterday: null, updatedAt: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      const now = new Date();
      const todayStart = startOfDay(now);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(todayStart.getDate() - 1);

      try {
        const [trendRows, yesterday] = await Promise.all([
          dashboardService.getChart('sales-trend', { range: 'today' }),
          canCompare
            ? loadYesterdayBuckets(`${userId}:${toDayKey(yesterdayStart)}`, yesterdayStart, todayStart).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setState({ status: 'ready', today: bucketsFromTrend(trendRows), yesterday, updatedAt: now });
      } catch {
        // Keep showing the last good frame on a failed refresh.
        if (!cancelled) setState((prev) => (prev.today ? prev : { ...prev, status: 'error' }));
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, canCompare, userId]);

  return state;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

function percentChange(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function sumUntil(buckets, lastHour) {
  return buckets.slice(0, lastHour + 1).reduce(
    (acc, bucket) => ({ value: acc.value + bucket.value, count: acc.count + bucket.count }),
    { value: 0, count: 0 },
  );
}

function peakHour(buckets, lastHour) {
  let peak = null;
  for (let hour = 0; hour <= lastHour; hour += 1) {
    if (buckets[hour].value > 0 && (peak === null || buckets[hour].value > buckets[peak].value)) peak = hour;
  }
  return peak;
}

function buildModel(today, yesterday, currentHour, metric) {
  const yesterdayBuckets = yesterday?.buckets ?? null;

  const activeHours = [];
  for (let hour = 0; hour < HOURS; hour += 1) {
    if (today[hour].count > 0 || (yesterdayBuckets && yesterdayBuckets[hour].count > 0)) activeHours.push(hour);
  }

  const startHour = Math.min(activeHours[0] ?? currentHour, DEFAULT_START_HOUR, currentHour);
  const endHour = Math.min(HOURS - 1, Math.max(activeHours.at(-1) ?? currentHour, currentHour, DEFAULT_END_HOUR));

  const rows = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    rows.push({
      hour,
      label: `${pad2(hour)}:00`,
      today: hour <= currentHour ? today[hour][metric] : null,
      yesterday: yesterdayBuckets ? yesterdayBuckets[hour][metric] : null,
    });
  }

  const todayTotals = sumUntil(today, currentHour);
  const yesterdayTotals = yesterdayBuckets ? sumUntil(yesterdayBuckets, currentHour) : null;

  return {
    rows,
    isEmpty: activeHours.length === 0,
    todayTotals,
    yesterdayTotals,
    todayPeak: peakHour(today, currentHour),
    yesterdayPeak: yesterdayBuckets ? peakHour(yesterdayBuckets, currentHour) : null,
  };
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

function AxisTick({ x, y, payload, tickAnchor = 'middle', tickDx = 0, tickDy = 16, tickFormat }) {
  return (
    <text x={x} y={y} dx={tickDx} dy={tickDy} textAnchor={tickAnchor} className={styles.tick}>
      {tickFormat ? tickFormat(payload.value) : payload.value}
    </text>
  );
}

function renderTodayDot({ cx: x, cy: y, index, payload }) {
  if (x == null || y == null || payload?.today == null) return <g key={`today-dot-${index}`} />;
  return <circle key={`today-dot-${index}`} cx={x} cy={y} r={3.5} className={styles.dotToday} />;
}

function renderYesterdayDot({ cx: x, cy: y, index, payload }) {
  if (x == null || y == null || payload?.yesterday == null) return <g key={`yesterday-dot-${index}`} />;
  return <circle key={`yesterday-dot-${index}`} cx={x} cy={y} r={2.5} className={styles.dotYesterday} />;
}

function renderTodayActiveDot({ cx: x, cy: y }) {
  if (x == null || y == null) return <g />;
  return (
    <g>
      <circle cx={x} cy={y} r={11} className={styles.activeHalo} />
      <circle cx={x} cy={y} r={5} className={styles.activeDotToday} />
    </g>
  );
}

function renderYesterdayActiveDot({ cx: x, cy: y }) {
  if (x == null || y == null) return <g />;
  return <circle cx={x} cy={y} r={4} className={styles.activeDotYesterday} />;
}

function DeltaChip({ percent }) {
  if (percent === null || !Number.isFinite(percent)) return <span className={styles.deltaNone}>{'—'}</span>;

  let tone = styles.deltaNeutral;
  let Icon = FiMinus;
  let sign = '';
  if (percent > 0) {
    tone = styles.deltaPositive;
    Icon = FiArrowUpRight;
    sign = '+';
  } else if (percent < 0) {
    tone = styles.deltaNegative;
    Icon = FiArrowDownRight;
    sign = '−';
  }

  return (
    <span className={cx(styles.delta, tone)}>
      <Icon aria-hidden="true" />
      {`${sign}${Math.abs(percent).toFixed(1)}%`}
    </span>
  );
}

function TrafficTooltip({ active, payload, formatValue, labels }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const hasYesterday = row.yesterday !== null && row.yesterday !== undefined;

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipHeader}>
        {labels.hourRange({ from: `${pad2(row.hour)}:00`, to: `${pad2(row.hour)}:59` })}
      </div>
      <div className={styles.tooltipRow}>
        <span className={cx(styles.tooltipSwatch, styles.tooltipSwatchToday)} aria-hidden="true" />
        <span className={styles.tooltipLabel}>{labels.today}</span>
        <span className={styles.tooltipValue}>{row.today === null ? '—' : formatValue(row.today)}</span>
      </div>
      {hasYesterday && (
        <div className={styles.tooltipRow}>
          <span className={cx(styles.tooltipSwatch, styles.tooltipSwatchYesterday)} aria-hidden="true" />
          <span className={styles.tooltipLabel}>{labels.yesterday}</span>
          <span className={styles.tooltipValue}>{formatValue(row.yesterday)}</span>
        </div>
      )}
      {hasYesterday && row.today !== null && (
        <div className={styles.tooltipFooter}>
          <DeltaChip percent={percentChange(row.today, row.yesterday)} />
        </div>
      )}
    </div>
  );
}

function TrafficSkeleton() {
  return (
    <div className={styles.body} aria-hidden="true">
      <div className={styles.chartArea}>
        <div className={styles.skeletonChart}>
          <span className={cx(styles.shimmer, styles.skeletonAxis)} />
          <span className={styles.skeletonGrid} />
          <span className={cx(styles.shimmer, styles.skeletonCurve)} />
        </div>
      </div>
      <div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={styles.skeletonRow}>
            <span className={cx(styles.shimmer, styles.skeletonCell)} />
            <span className={cx(styles.shimmer, styles.skeletonCell)} />
            <span className={cx(styles.shimmer, styles.skeletonCell)} />
            <span className={cx(styles.shimmer, styles.skeletonCell)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CustomerTrafficChart() {
  const { t, i18n } = useTranslation('dashboard');
  const { user, hasPermission } = useAuth();
  const { isModuleEnabled, loading: modulesLoading } = useModules();
  const [metric, setMetric] = useState('value');
  const gradientId = `traffic-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Yesterday is read from GET /sales, which needs its own permission and
  // the sales module — without either, the chart shows today only.
  const canCompare = hasPermission('sales.view') && isModuleEnabled('sales');
  const traffic = useLiveTraffic({ enabled: !modulesLoading, canCompare, userId: user?.id ?? 'anonymous' });

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const isRevenue = metric === 'value';
  const formatValue = isRevenue ? formatCurrency : formatNumber;
  const formatAxis = isRevenue ? (value) => compactAmount.format(value) : formatNumber;

  const model = useMemo(() => {
    if (traffic.status !== 'ready' || !traffic.today) return null;
    return buildModel(traffic.today, traffic.yesterday, traffic.updatedAt.getHours(), metric);
  }, [traffic, metric]);

  const hasYesterday = Boolean(traffic.yesterday);
  const hourRange = (hour) => (hour === null ? '—' : t('traffic.hourRange', { from: `${pad2(hour)}:00`, to: `${pad2(hour)}:59` }));

  const matrixRows = model
    ? (() => {
      const todayAvg = model.todayTotals.count ? model.todayTotals.value / model.todayTotals.count : 0;
      const yesterdayAvg = model.yesterdayTotals?.count ? model.yesterdayTotals.value / model.yesterdayTotals.count : null;
      return [
        {
          key: 'revenue',
          label: t('traffic.rowRevenue'),
          today: formatCurrency(model.todayTotals.value),
          yesterday: model.yesterdayTotals ? formatCurrency(model.yesterdayTotals.value) : '—',
          delta: model.yesterdayTotals ? percentChange(model.todayTotals.value, model.yesterdayTotals.value) : null,
        },
        {
          key: 'transactions',
          label: t('traffic.rowTransactions'),
          today: formatNumber(model.todayTotals.count),
          yesterday: model.yesterdayTotals ? formatNumber(model.yesterdayTotals.count) : '—',
          delta: model.yesterdayTotals ? percentChange(model.todayTotals.count, model.yesterdayTotals.count) : null,
        },
        {
          key: 'average',
          label: t('traffic.rowAverageTicket'),
          today: formatCurrency(todayAvg),
          yesterday: yesterdayAvg === null ? '—' : formatCurrency(yesterdayAvg),
          delta: yesterdayAvg === null ? null : percentChange(todayAvg, yesterdayAvg),
        },
        {
          key: 'peak',
          label: t('traffic.rowPeakHour'),
          today: hourRange(model.todayPeak),
          yesterday: hasYesterday ? hourRange(model.yesterdayPeak) : '—',
          delta: null,
        },
      ];
    })()
    : [];

  let notice = '';
  if (!canCompare) notice = t('traffic.todayOnly');
  else if (traffic.yesterday?.truncated) notice = t('traffic.partialYesterday', { count: SALES_PAGE_LIMIT * MAX_SALES_PAGES });

  const tooltipLabels = {
    today: t('traffic.today'),
    yesterday: t('traffic.yesterday'),
    hourRange: (values) => t('traffic.hourRange', values),
  };

  return (
    <section className={styles.card} aria-labelledby={`${gradientId}-title`} aria-busy={traffic.status === 'loading'}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <span className={styles.liveDot} aria-hidden="true" />
            <h2 id={`${gradientId}-title`} className={styles.title}>{t('traffic.title')}</h2>
          </div>
          <p className={styles.subtitle}>{t('traffic.subtitle')}</p>
        </div>

        <div className={styles.controls}>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.swatchToday} aria-hidden="true" />
              {t('traffic.today')}
            </span>
            {canCompare && (
              <span className={styles.legendItem}>
                <span className={styles.swatchYesterday} aria-hidden="true" />
                {t('traffic.yesterday')}
              </span>
            )}
          </div>
          <div className={styles.segmented} role="group" aria-label={t('traffic.metricToggle')}>
            <button type="button" className={styles.segment} aria-pressed={isRevenue} onClick={() => setMetric('value')}>
              {t('traffic.metricRevenue')}
            </button>
            <button type="button" className={styles.segment} aria-pressed={!isRevenue} onClick={() => setMetric('count')}>
              {t('traffic.metricTransactions')}
            </button>
          </div>
        </div>
      </header>

      {traffic.status === 'loading' && <TrafficSkeleton />}

      {traffic.status === 'error' && (
        <div className={styles.body}>
          <div className={styles.chartArea}>
            <div className={styles.error} role="alert">{t('traffic.loadError')}</div>
          </div>
        </div>
      )}

      {model && (
        <div className={styles.body}>
          <div className={styles.chartArea}>
            {model.isEmpty ? (
              <div className={styles.empty}>{t('traffic.empty')}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={model.rows} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" className={styles.gradientStopTop} />
                      <stop offset="100%" className={styles.gradientStopBottom} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={<AxisTick />}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    width={56}
                    tick={<AxisTick tickAnchor="end" tickDx={-8} tickDy={4} tickFormat={formatAxis} />}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={isRevenue}
                  />
                  <Tooltip
                    cursor
                    isAnimationActive={false}
                    content={(props) => <TrafficTooltip {...props} formatValue={formatValue} labels={tooltipLabels} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="today"
                    className={styles.todayArea}
                    fill={`url(#${gradientId})`}
                    stroke="none"
                    activeDot={false}
                    tooltipType="none"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {hasYesterday && (
                    <Line
                      type="monotone"
                      dataKey="yesterday"
                      className={styles.yesterdaySeries}
                      stroke="currentColor"
                      dot={renderYesterdayDot}
                      activeDot={renderYesterdayActiveDot}
                      animationDuration={500}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="today"
                    className={styles.todaySeries}
                    stroke="currentColor"
                    connectNulls={false}
                    dot={renderTodayDot}
                    activeDot={renderTodayActiveDot}
                    animationDuration={600}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className={styles.matrixWrap}>
            <table className={styles.matrix}>
              <caption className={styles.matrixCaption}>{t('traffic.matrixCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className={styles.srOnly}>{t('traffic.metricToggle')}</span></th>
                  <th scope="col" className={styles.num}>{t('traffic.today')}</th>
                  <th scope="col" className={styles.num}>{t('traffic.sameTimeYesterday')}</th>
                  <th scope="col" className={styles.num}>{t('traffic.change')}</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td className={cx(styles.num, styles.numStrong)}>{row.today}</td>
                    <td className={styles.num}>{row.yesterday}</td>
                    <td className={styles.num}><DeltaChip percent={row.delta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(model || notice) && (
        <footer className={styles.footer}>
          <span className={styles.notice}>{notice}</span>
          {traffic.updatedAt && (
            <span className={styles.updated}>
              {t('traffic.updated', { time: traffic.updatedAt.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) })}
            </span>
          )}
        </footer>
      )}
    </section>
  );
}

export default CustomerTrafficChart;
