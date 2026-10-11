import styles from './Charts.module.css';

// Custom Recharts tooltip content shared by LineChart and BarChart.
// `series` maps each dataKey to { name, color } so the tooltip can show
// a swatch and a readable label for every value under the cursor.
function ChartTooltip({ active, payload, label, series, valueFormatter = (value) => value }) {
  if (!active || !payload?.length) return null;

  const entries = payload.filter((entry) => series[entry.dataKey]);

  return (
    <div className={styles.tooltip}>
      {label !== undefined && label !== '' && <div className={styles.tooltipLabel}>{label}</div>}
      {entries.map((entry) => {
        const meta = series[entry.dataKey];
        return (
          <div key={entry.dataKey} className={styles.tooltipRow}>
            <span className={styles.tooltipSwatch} style={meta.color ? { '--swatch': meta.color } : undefined} aria-hidden="true" />
            <span className={styles.tooltipName}>{meta.name}</span>
            <span className={styles.tooltipValue}>{valueFormatter(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default ChartTooltip;
