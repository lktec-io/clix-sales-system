import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiMapPin } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useModules } from '../../hooks/useModules';
import { resolveBusinessTheme } from '../../constants/businessThemes';
import '../../styles/components/DashboardHero.css';

function useLiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  return now;
}

function DashboardHero() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { user } = useAuth();
  const { businessTemplateSlug } = useModules();
  const businessTheme = resolveBusinessTheme(businessTemplateSlug);
  const BusinessIcon = businessTheme.icon;
  const now = useLiveClock();

  function getGreeting(hour) {
    if (hour < 12) return t('dashboard:hero.goodMorning');
    if (hour < 17) return t('dashboard:hero.goodAfternoon');
    return t('dashboard:hero.goodEvening');
  }

  const firstName = user?.first_name || t('dashboard:hero.guestName');
  const branchLabel = user?.branch_name || t('common:labels.allBranches');
  const greeting = getGreeting(now.getHours());
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const dateLabel = now.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' });
  const timeLabel = now.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      className="dashboard-hero"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="dashboard-hero-orb" aria-hidden="true" />

      <motion.div className="dashboard-hero-greeting-block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <span className="dashboard-hero-eyebrow">{greeting}</span>
        <h1 className="dashboard-hero-title">{t('dashboard:hero.welcomeBack')} <span className="dashboard-hero-name">{firstName}</span></h1>
        <p className="dashboard-hero-subtitle">{t('dashboard:hero.subtitle')}</p>
      </motion.div>

      <div className="dashboard-hero-meta">
        {businessTheme.label && (
          <span className="dashboard-hero-chip dashboard-hero-chip-business">
            <BusinessIcon aria-hidden="true" /> {businessTheme.label}
          </span>
        )}
        <span className="dashboard-hero-chip">{dateLabel}</span>
        <span className="dashboard-hero-chip dashboard-hero-chip-time">{timeLabel}</span>
        <span className="dashboard-hero-chip">
          <FiMapPin aria-hidden="true" /> {branchLabel}
        </span>
      </div>
    </motion.div>
  );
}

export default DashboardHero;
