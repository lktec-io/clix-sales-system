import { FiArrowDownRight, FiArrowUpRight, FiMinus } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import AnimatedCounter from './AnimatedCounter';
import styles from './KPICard.module.css';

const cx = (...classNames) => classNames.filter(Boolean).join(' ');

const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 36;
const SPARK_PAD = 3;

// Tiny trend line for the card's corner. Only drawn from a real series the
// caller passes — never a decorative fake.
function Sparkline({ values }) {
  const points = values.map((v) => Number(v) || 0);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (SPARK_WIDTH - SPARK_PAD * 2) / (points.length - 1);

  const coords = points.map((v, index) => [
    SPARK_PAD + index * stepX,
    SPARK_PAD + (SPARK_HEIGHT - SPARK_PAD * 2) * (1 - (v - min) / range),
  ]);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1];
  const area = `${SPARK_PAD},${SPARK_HEIGHT} ${line} ${lastX.toFixed(1)},${SPARK_HEIGHT}`;

  return (
    <svg className={styles.spark} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} aria-hidden="true" focusable="false">
      <polygon className={styles.sparkArea} points={area} />
      <polyline className={styles.sparkLine} points={line} />
      <circle className={styles.sparkDot} cx={lastX} cy={lastY} r={3} />
    </svg>
  );
}

// Same props as before plus an optional `sparkline` (array of numbers).
// `trend` is deliberately not defaulted — a KPI without an honest
// comparison shows no growth chip rather than a fabricated "0%". `accent`
// is accepted for compatibility; the unified brand no longer tints cards.
function KPICard({ icon: Icon, label, value, formatter, subtitle, trend, sparkline }) {
  const { t } = useTranslation('dashboard');

  let trendClass = styles.trendFlat;
  let TrendIcon = FiMinus;
  let sign = '';
  if (trend?.direction === 'up' && trend.percent !== 0) {
    trendClass = styles.trendUp;
    TrendIcon = FiArrowUpRight;
    sign = '+';
  } else if (trend?.direction === 'down') {
    trendClass = styles.trendDown;
    TrendIcon = FiArrowDownRight;
    sign = '−';
  }

  const showSpark = Array.isArray(sparkline) && sparkline.length >= 2;

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <span className={styles.icon} aria-hidden="true">
            <Icon />
          </span>
        )}
      </div>

      <div className={styles.value}>
        <AnimatedCounter value={value} formatter={formatter || ((v) => v)} />
      </div>

      {(subtitle || trend || showSpark) && (
        <div className={styles.bottom}>
          <div className={styles.meta}>
            {trend && (
              <span className={cx(styles.trend, trendClass)}>
                <TrendIcon aria-hidden="true" />
                <span className={styles.trendPercent}>{`${sign}${Math.abs(trend.percent).toFixed(1)}%`}</span>
                <span className={styles.trendCaption}>{t('kpi.vsYesterdayShort')}</span>
              </span>
            )}
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
          {showSpark && <Sparkline values={sparkline} />}
        </div>
      )}
    </div>
  );
}

export default KPICard;
