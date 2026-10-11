import { useTranslation } from 'react-i18next';
import {
  Bar, BarChart as RechartsBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import styles from './Charts.module.css';

const compact = new Intl.NumberFormat('en-TZ', { notation: 'compact', maximumFractionDigits: 1 });
const FILL_CLASSES = [styles.fill0, styles.fill1, styles.fill2, styles.fill3, styles.fill4];

function NumberTick({ x, y, payload, horizontal }) {
  return horizontal ? (
    <text x={x} y={y} dy={16} textAnchor="middle" className={styles.tick}>{compact.format(payload.value)}</text>
  ) : (
    <text x={x} y={y} dx={-8} dy={4} textAnchor="end" className={styles.tick}>{compact.format(payload.value)}</text>
  );
}

function CategoryTick({ x, y, payload, horizontal }) {
  const text = String(payload.value ?? '');
  const label = horizontal && text.length > 18 ? `${text.slice(0, 17)}…` : text;
  return horizontal ? (
    <text x={x} y={y} dx={-8} dy={4} textAnchor="end" className={styles.categoryTick}>{label}</text>
  ) : (
    <text x={x} y={y} dy={16} textAnchor="middle" className={styles.tick}>{label}</text>
  );
}

// Same props as the previous Chart.js version:
//   single series  → labels + values (+ optional label/color)
//   grouped series → labels + datasets: [{ label, values, color }]
//   horizontal     → category axis on the left (ranked lists)
// Omitted colours fall back to the --chart-N tokens.
function BarChart({
  labels, values, label, color, horizontal = false,
  datasets = null, valueFormatter = (value) => value, height = 260,
}) {
  const { t } = useTranslation('common');

  const seriesList = datasets
    ? datasets.map((dataset, index) => ({
      key: `s${index}`,
      name: dataset.label,
      values: dataset.values,
      color: dataset.color,
      fallback: `var(--chart-${(index % 5) + 1})`,
      fillClass: FILL_CLASSES[index % FILL_CLASSES.length],
    }))
    : [{ key: 's0', name: label ?? t('chart.value'), values, color, fallback: 'var(--chart-1)', fillClass: FILL_CLASSES[0] }];

  const data = labels.map((category, index) => {
    const row = { label: category };
    seriesList.forEach((s) => {
      row[s.key] = Number(s.values?.[index]) || 0;
    });
    return row;
  });

  const tooltipSeries = Object.fromEntries(seriesList.map((s) => [s.key, { name: s.name, color: s.color || s.fallback }]));
  const barSize = datasets ? 20 : 28;

  return (
    <div className={styles.frame}>
      {datasets && (
        <div className={styles.legend}>
          {seriesList.map((s) => (
            <span key={s.key} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ '--swatch': s.color || s.fallback }} aria-hidden="true" />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: 12, bottom: 4, left: horizontal ? 8 : 0 }}
            barGap={4}
          >
            <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" tick={<NumberTick horizontal />} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={132} tick={<CategoryTick horizontal />} tickLine={false} axisLine={false} interval={0} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tick={<CategoryTick />} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis width={56} tick={<NumberTick />} tickLine={false} axisLine={false} />
              </>
            )}
            <Tooltip
              isAnimationActive={false}
              content={(props) => <ChartTooltip {...props} series={tooltipSeries} valueFormatter={valueFormatter} />}
            />
            {seriesList.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                className={s.color ? undefined : s.fillClass}
                fill={s.color || 'currentColor'}
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                maxBarSize={barSize}
                animationDuration={500}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default BarChart;
