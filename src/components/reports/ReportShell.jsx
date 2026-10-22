import { useTranslation } from 'react-i18next';
import { FiDownload, FiPrinter, FiRefreshCw } from 'react-icons/fi';
import { presetRange } from '../../utils/reportData';
import styles from './ReportShell.module.css';

const cx = (...classNames) => classNames.filter(Boolean).join(' ');
const PRESETS = ['today', 'yesterday', '7d', '30d', 'month'];

// Frame shared by every module report: title, date-range bar with presets,
// refresh / CSV / print actions, stat cards, notices and the report body.
export function ReportShell({
  title, subtitle, icon: Icon, range, onRangeChange, showRange = true,
  onRefresh, onExport, loading, error, notice, stats, children,
}) {
  const { t } = useTranslation('reports');

  return (
    <section className={styles.report} aria-busy={loading}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          {Icon && <span className={styles.icon} aria-hidden="true"><Icon /></span>}
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
        <div className={cx(styles.actions, 'no-print')}>
          {onRefresh && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
              <FiRefreshCw aria-hidden="true" /> {t('business.refresh')}
            </button>
          )}
          {onExport && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onExport} disabled={loading}>
              <FiDownload aria-hidden="true" /> {t('business.exportCsv')}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <FiPrinter aria-hidden="true" /> {t('business.print')}
          </button>
        </div>
      </header>

      {showRange && range && (
        <div className={cx(styles.rangeBar, 'no-print')}>
          <div className={styles.presets} role="group" aria-label={t('business.rangeLabel')}>
            {PRESETS.map((preset) => {
              const presetValue = presetRange(preset);
              const active = presetValue.from === range.from && presetValue.to === range.to;
              return (
                <button key={preset} type="button" className={styles.preset} aria-pressed={active} onClick={() => onRangeChange(presetValue)}>
                  {t(`business.presets.${preset}`)}
                </button>
              );
            })}
          </div>
          <div className={styles.dates}>
            <label className={styles.dateField}>
              <span>{t('business.from')}</span>
              <input
                type="date"
                className="form-control"
                value={range.from}
                max={range.to}
                onChange={(e) => e.target.value && onRangeChange({ ...range, from: e.target.value })}
              />
            </label>
            <label className={styles.dateField}>
              <span>{t('business.to')}</span>
              <input
                type="date"
                className="form-control"
                value={range.to}
                min={range.from}
                onChange={(e) => e.target.value && onRangeChange({ ...range, to: e.target.value })}
              />
            </label>
          </div>
        </div>
      )}

      {range && <p className={styles.printRange}>{t('business.printRange', { from: range.from, to: range.to })}</p>}

      {error && <div className="alert alert-danger" role="alert">{t('business.loadError')}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}

      {stats && <StatGrid stats={stats} loading={loading} />}

      {children}
    </section>
  );
}

// Summary cards. stat: { label, value, hint?, tone?: 'positive'|'negative'|'warning' }
export function StatGrid({ stats, loading }) {
  return (
    <div className={styles.stats}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.stat} data-tone={stat.tone}>
          <span className={styles.statLabel}>{stat.label}</span>
          {loading ? (
            <span className={cx('skeleton', styles.statSkeleton)} aria-hidden="true" />
          ) : (
            <span className={styles.statValue}>{stat.value}</span>
          )}
          {stat.hint && !loading && <span className={styles.statHint}>{stat.hint}</span>}
        </div>
      ))}
    </div>
  );
}

// Card section with a navy header strip.
export function ReportSection({ title, actions, children, wide = false }) {
  return (
    <section className={cx(styles.section, wide && styles.sectionWide)}>
      <header className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {actions && <div className={cx(styles.sectionActions, 'no-print')}>{actions}</div>}
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function ReportGrid({ children }) {
  return <div className={styles.grid}>{children}</div>;
}

// Dense table. columns: [{ key, label, numeric?, render?(row) }]; footer: row-shaped totals.
export function ReportTable({ columns, rows, loading, emptyMessage, footer, maxRows, rowKey = 'key' }) {
  const { t } = useTranslation('reports');
  const visible = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <div className="table-wrapper">
      <table className={cx('table', styles.denseTable)}>
        <thead>
          <tr>
            {columns.map((col) => <th key={col.key} className={col.numeric ? 'cell-num' : undefined}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: 4 }, (_, i) => (
            <tr key={`sk-${i}`} aria-hidden="true">
              {columns.map((col) => <td key={col.key}><span className={cx('skeleton', styles.cellSkeleton)} /></td>)}
            </tr>
          ))}
          {!loading && visible.length === 0 && (
            <tr><td colSpan={columns.length} className={styles.empty}>{emptyMessage || t('business.noData')}</td></tr>
          )}
          {!loading && visible.map((row, index) => (
            <tr key={row[rowKey] ?? index} className={row.rowClass}>
              {columns.map((col) => (
                <td key={col.key} className={col.numeric ? 'cell-num' : undefined}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {!loading && footer && visible.length > 0 && (
          <tfoot>
            <tr className={styles.totalRow}>
              {columns.map((col) => (
                <td key={col.key} className={col.numeric ? 'cell-num' : undefined}>{footer[col.key] ?? ''}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {!loading && maxRows && rows.length > maxRows && (
        <p className={styles.moreRows}>{t('business.moreRows', { shown: maxRows, total: rows.length })}</p>
      )}
    </div>
  );
}

// Horizontal bar list for distributions (status mix, buckets, top items).
export function BarList({ items, formatValue = (v) => v }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className={styles.barList}>
      {items.map((item) => (
        <li key={item.label} className={styles.barRow}>
          <span className={styles.barLabel}>{item.label}</span>
          <span className={styles.barTrack} aria-hidden="true">
            <span className={styles.barFill} data-tone={item.tone} style={{ '--w': `${(item.value / max) * 100}%` }} />
          </span>
          <span className={styles.barValue}>{formatValue(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export default ReportShell;
