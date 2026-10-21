import styles from './ProgressBar.module.css';

const cx = (...classNames) => classNames.filter(Boolean).join(' ');

const TONE_CLASS = {
  success: styles.toneSuccess,
  accent: styles.toneAccent,
  danger: styles.toneDanger,
};

// Accessible completion bar. `value` is a 0–1 fraction (clamped).
//   label       accessible name (also shown when `showLabel`)
//   caption     optional secondary text under the bar
//   tone        'success' (default) | 'accent' | 'danger'
//   size        'md' (default) | 'sm' for table cells
function ProgressBar({ value, label, caption, tone = 'success', size = 'md', showLabel = false, showPercent = true }) {
  const fraction = Math.min(1, Math.max(0, Number(value) || 0));
  const percent = Math.round(fraction * 1000) / 10;

  return (
    <div className={cx(styles.wrap, size === 'sm' && styles.small)}>
      {(showLabel || showPercent) && (
        <div className={styles.head}>
          {showLabel && <span className={styles.label}>{label}</span>}
          {showPercent && <span className={styles.percent}>{`${percent}%`}</span>}
        </div>
      )}
      <div
        className={cx(styles.track, TONE_CLASS[tone] || styles.toneSuccess)}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className={styles.fill} style={{ '--fraction': fraction }} />
      </div>
      {caption && <span className={styles.caption}>{caption}</span>}
    </div>
  );
}

export default ProgressBar;
