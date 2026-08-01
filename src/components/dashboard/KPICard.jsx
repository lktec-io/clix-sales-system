import { motion } from 'framer-motion';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import AnimatedCounter from './AnimatedCounter';

// Turns a "#RRGGBB" accent into an "r, g, b" triple so CSS can build
// low-opacity washes/glows from it via rgba(var(--kpi-accent-rgb), a) —
// every accent in Dashboard.jsx's KPI_DEFS is a plain hex literal, so this
// never needs to handle named colors or shorthand hex.
function hexToRgbTriple(hex) {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// `trend` is optional and deliberately not defaulted to 0 — a KPI with no
// real day-over-day (or period-over-period) comparison available should
// show no trend at all rather than a fabricated "0%" or invented direction.
function KPICard({ icon: Icon, label, value, formatter, subtitle, accent, trend }) {
  const { t } = useTranslation('dashboard');
  const gradientStyle = accent ? { backgroundImage: `linear-gradient(135deg, var(--color-primary), ${accent})` } : undefined;
  // Each card gets its own identity via one CSS custom property — the
  // background wash, hover glow, and accent bar in cards.css all derive
  // from this single source instead of three separate inline styles.
  const cardStyle = accent ? { '--kpi-accent-rgb': hexToRgbTriple(accent), '--kpi-accent': accent } : undefined;
  const TrendIcon = trend?.direction === 'down' ? FiArrowDown : FiArrowUp;

  return (
    <div className="card card-hover kpi-card kpi-card-glow" style={cardStyle}>
      <span className="kpi-card-shimmer" aria-hidden="true" />
      <div className="kpi-card-main">
        <div className="kpi-card-label">{label}</div>
        <div className="kpi-card-value">
          <AnimatedCounter value={value} formatter={formatter || ((v) => v)} />
        </div>
        {subtitle && <div className="kpi-card-subtitle">{subtitle}</div>}
        {trend && (
          <div className={`kpi-card-trend ${trend.direction === 'down' ? 'kpi-card-trend-down' : 'kpi-card-trend-up'}`}>
            <TrendIcon aria-hidden="true" /> {t('kpi.trendVsYesterday', { percent: Math.abs(trend.percent).toFixed(1) })}
          </div>
        )}
      </div>
      {Icon && (
        <motion.div
          className="kpi-card-icon"
          style={gradientStyle}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon aria-hidden="true" />
        </motion.div>
      )}
      <motion.span
        className="kpi-card-accent-bar"
        style={accent ? { backgroundColor: accent } : undefined}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export default KPICard;
