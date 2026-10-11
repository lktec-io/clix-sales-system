import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import styles from './Charts.module.css';

const compact = new Intl.NumberFormat('en-TZ', { notation: 'compact', maximumFractionDigits: 1 });

function ValueTick({ x, y, payload, tickFormat }) {
  return (
    <text x={x} y={y} dx={-8} dy={4} textAnchor="end" className={styles.tick}>
      {tickFormat(payload.value)}
    </text>
  );
}

function LabelTick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={16} textAnchor="middle" className={styles.tick}>
      {payload.value}
    </text>
  );
}

function renderActiveDot({ cx: x, cy: y }) {
  if (x == null || y == null) return <g />;
  return <circle cx={x} cy={y} r={5} className={styles.activeDot} />;
}

// Single-series trend line with a soft gradient fill. Same props as the
// previous Chart.js version: `color` is optional (defaults to --chart-1)
// and `valueFormatter` formats tooltip values; the axis uses a compact
// form of the same numbers so long currency strings never crowd it.
function LineChart({ labels, values, color, valueFormatter = (value) => value, height = 280 }) {
  const { t } = useTranslation('common');
  const gradientId = `line-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const data = labels.map((label, index) => ({ label, value: Number(values[index]) || 0 }));
  const series = { value: { name: t('chart.value'), color } };

  return (
    <div className={styles.frame} style={{ height, ...(color ? { '--series': color } : {}) }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className={styles.gradientStopTop} />
              <stop offset="100%" className={styles.gradientStopBottom} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tick={<LabelTick />} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
          <YAxis
            width={56}
            tick={<ValueTick tickFormat={(value) => compact.format(value)} />}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            isAnimationActive={false}
            content={(props) => <ChartTooltip {...props} series={series} valueFormatter={valueFormatter} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={renderActiveDot}
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default LineChart;
