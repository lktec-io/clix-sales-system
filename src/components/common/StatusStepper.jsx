import { FiCheck, FiX } from 'react-icons/fi';
import styles from './StatusStepper.module.css';

const cx = (...classNames) => classNames.filter(Boolean).join(' ');

// Visual progress stepper for any status lifecycle (repairs, loans, orders).
//   steps         [{ key, label }]
//   currentIndex  index of the active step
//   hint          optional sub-label under the current step (e.g. the exact
//                 backend status when several share one stage)
//   ended         { label } when the flow stopped early (cancelled/rejected)
//                 — every step up to currentIndex reads as done and a red
//                 terminal node is appended
//   complete      true when the last step itself is finished
function StatusStepper({ steps, currentIndex, hint, ended, complete = false, label }) {
  const lastIndex = steps.length - 1;
  const progress = lastIndex > 0 ? Math.min(currentIndex, lastIndex) / lastIndex : 0;

  const stateOf = (index) => {
    if (ended) return index <= currentIndex ? 'done' : 'upcoming';
    if (index < currentIndex || (complete && index === currentIndex)) return 'done';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className={styles.wrap}>
      <ol
        className={cx(styles.stepper, ended && styles.stepperEnded)}
        aria-label={label}
        style={{ '--progress': progress, '--steps': steps.length + (ended ? 1 : 0) }}
      >
        {steps.map((step, index) => {
          const state = stateOf(index);
          return (
            <li
              key={step.key}
              className={styles.step}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className={styles.node} aria-hidden="true">
                {state === 'done' ? <FiCheck /> : <span className={styles.nodeIndex}>{index + 1}</span>}
              </span>
              <span className={styles.text}>
                <span className={styles.label}>{step.label}</span>
                {state === 'current' && hint && <span className={styles.hint}>{hint}</span>}
              </span>
            </li>
          );
        })}
        {ended && (
          <li className={styles.step} data-state="ended" aria-current="step">
            <span className={styles.node} aria-hidden="true"><FiX /></span>
            <span className={styles.text}>
              <span className={styles.label}>{ended.label}</span>
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}

export default StatusStepper;
