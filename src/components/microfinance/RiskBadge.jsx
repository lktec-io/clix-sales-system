import { useTranslation } from 'react-i18next';
import styles from './Microfinance.module.css';

const TONE = {
  performing: styles.riskPerforming,
  paid: styles.riskPerforming,
  grace: styles.riskGrace,
  overdue: styles.riskOverdue,
  due: styles.riskDue,
};

// Fintech health pill: performing / paid (emerald), grace (blue),
// overdue (red), due (neutral).
function RiskBadge({ health }) {
  const { t } = useTranslation('microfinance');
  if (!health) return null;
  return <span className={`${styles.risk} ${TONE[health]}`}>{t(`fintech.risk.${health}`)}</span>;
}

export default RiskBadge;
