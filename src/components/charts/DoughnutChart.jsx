import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useChartTheme } from './chartTheme';
import '../../styles/components/DoughnutChart.css';

const RADIUS = 32;
const STROKE_WIDTH = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const LABEL_RADIUS = 43;
const GAP = 1.4;
const MIN_LABEL_PERCENT = 6;

// cx/cy are always 50 — the whole chart is drawn in a 0-100 unit space that
// doubles as the CSS percentage space for the HTML label overlay, so slice
// angle math and label positioning share one coordinate system.
function polarPoint(angleDeg, radius) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

// Folds data beyond the fixed, non-cycled palette length into a single
// "Other" slice rather than repeating colors or growing the palette ad hoc.
// Palette/otherColor come from the active theme so a theme switch recolors
// every slice on next render.
function prepareSlices(data, palette, otherColor, otherLabel) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const maxSlices = palette.length;
  let visible = sorted;
  let other = null;
  if (sorted.length > maxSlices) {
    visible = sorted.slice(0, maxSlices - 1);
    const otherValue = sorted.slice(maxSlices - 1).reduce((sum, d) => sum + d.value, 0);
    other = { label: otherLabel, value: otherValue };
  }
  const total = sorted.reduce((sum, d) => sum + d.value, 0);
  const items = other ? [...visible, other] : visible;

  const percents = items.map((item) => (total > 0 ? (item.value / total) * 100 : 0));
  const startPercents = percents.map((_, index) => percents.slice(0, index).reduce((sum, p) => sum + p, 0));

  return items.map((item, index) => ({
    ...item,
    percent: percents[index],
    startPercent: startPercents[index],
    color: item === other ? otherColor : palette[index % palette.length],
    midAngle: ((startPercents[index] + percents[index] / 2) / 100) * 360,
  }));
}

function DoughnutChart({ data, valueFormatter = (v) => v }) {
  const { t } = useTranslation('common');
  const chartColors = useChartTheme();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const slices = prepareSlices(data || [], chartColors.doughnut, chartColors.doughnutOther, t('chart.other'));
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const hovered = hoveredIndex !== null ? slices[hoveredIndex] : null;

  return (
    <motion.div
      className="doughnut-chart"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="doughnut-chart-ring-wrap">
        <svg className="doughnut-chart-svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke={chartColors.doughnutTrack} strokeWidth={STROKE_WIDTH} />
          {slices.map((slice, index) => {
            const sliceLength = (slice.percent / 100) * CIRCUMFERENCE;
            const visibleLength = Math.max(sliceLength - GAP, 0);
            const offset = -(slice.startPercent / 100) * CIRCUMFERENCE;
            const isDimmed = hoveredIndex !== null && hoveredIndex !== index;
            return (
              <circle
                key={slice.label}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={isDimmed ? STROKE_WIDTH - 2 : STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={`${visibleLength} ${CIRCUMFERENCE - visibleLength}`}
                strokeDashoffset={offset}
                opacity={isDimmed ? 0.4 : 1}
                className="doughnut-chart-slice"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        <div className="doughnut-chart-center">
          {hovered ? (
            <>
              <span className="doughnut-chart-center-value">{Math.round(hovered.percent)}%</span>
              <span className="doughnut-chart-center-label">{hovered.label}</span>
            </>
          ) : (
            <>
              <span className="doughnut-chart-center-value">{valueFormatter(total)}</span>
              <span className="doughnut-chart-center-label">{t('chart.total')}</span>
            </>
          )}
        </div>

        {slices.filter((s) => s.percent >= MIN_LABEL_PERCENT).map((slice) => {
          const point = polarPoint(slice.midAngle, LABEL_RADIUS);
          return (
            <span
              key={slice.label}
              className="doughnut-chart-outside-label"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              {slice.label.length > 12 ? `${slice.label.slice(0, 11)}…` : slice.label} {Math.round(slice.percent)}%
            </span>
          );
        })}

        {hovered && (
          <div className="doughnut-chart-tooltip">
            <span className="doughnut-chart-tooltip-label">{hovered.label}</span>
            <span className="doughnut-chart-tooltip-value">{valueFormatter(hovered.value)} &middot; {Math.round(hovered.percent)}%</span>
          </div>
        )}
      </div>

      <div className="doughnut-chart-legend">
        {slices.map((slice, index) => (
          <button
            type="button"
            key={slice.label}
            className="doughnut-chart-legend-item"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span className="doughnut-chart-legend-swatch" style={{ backgroundColor: slice.color }} aria-hidden="true" />
            <span className="doughnut-chart-legend-name">{slice.label}</span>
            <span className="doughnut-chart-legend-percent">{Math.round(slice.percent)}%</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default DoughnutChart;
