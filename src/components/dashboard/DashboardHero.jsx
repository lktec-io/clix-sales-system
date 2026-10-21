import { useEffect, useState } from 'react';
import { FiCalendar, FiMapPin } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import styles from './DashboardHero.module.css';

const RANGE_KEYS = ['today', 'week', 'month', 'year'];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// Clean "Welcome back" header: greeting, today's date and branch, plus
// optional date-range pills (when `range`/`onRangeChange` are passed they
// drive the dashboard's Sales Trend chart).
function DashboardHero({ range, onRangeChange }) {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { user } = useAuth();
  const now = useClock();

  const hour = now.getHours();
  let greeting = t('dashboard:hero.goodEvening');
  if (hour < 12) greeting = t('dashboard:hero.goodMorning');
  else if (hour < 17) greeting = t('dashboard:hero.goodAfternoon');

  const firstName = user?.first_name || t('dashboard:hero.guestName');
  const branchLabel = user?.branch_name || t('common:labels.allBranches');
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const dateLabel = now.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header className={styles.hero}>
      <div className={styles.text}>
        <p className={styles.greeting}>{greeting}</p>
        <h1 className={styles.title}>
          {t('dashboard:hero.welcomeBack')} <span className={styles.name}>{firstName}</span>
        </h1>
        <p className={styles.meta}>
          <span className={styles.metaItem}><FiCalendar aria-hidden="true" /> {dateLabel}</span>
          <span className={styles.metaItem}><FiMapPin aria-hidden="true" /> {branchLabel}</span>
        </p>
      </div>

      {range && onRangeChange && (
        <div className={styles.pills} role="group" aria-label={t('dashboard:charts.salesTrendRange')}>
          {RANGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.pill}
              aria-pressed={range === key}
              onClick={() => onRangeChange(key)}
            >
              {t(`dashboard:charts.${key}`)}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

export default DashboardHero;
