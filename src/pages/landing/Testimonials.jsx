import { useTranslation } from 'react-i18next';
import { FiGrid, FiClock, FiGlobe, FiMapPin, FiShield } from 'react-icons/fi';

// Replaces a prior version that rendered three fabricated customer quotes
// (invented names/roles, presented as real testimonials with no
// disclosure) — an explicit product decision to never fabricate social
// proof. This shows honest, verifiable facts about what the product
// actually does instead — no invented customer counts, no uptime
// percentages, no reviews. See landing:trust.* — every fact here traces to
// real, checkable product behavior (six real templates, the real trial
// engine, real bilingual i18n coverage, real multi-branch/tenant-isolation
// architecture).
const FACT_ICONS = [FiGrid, FiClock, FiGlobe, FiMapPin, FiShield];
const FACT_KEYS = ['fact1', 'fact2', 'fact3', 'fact4', 'fact5'];

function Testimonials() {
  const { t } = useTranslation('landing');

  return (
    <section className="landing-section">
      <div className="landing-section-header">
        <h2>{t('trust.title')}</h2>
        <p>{t('trust.subtitle')}</p>
      </div>

      <ul className="landing-trust-grid">
        {FACT_KEYS.map((key, index) => {
          const Icon = FACT_ICONS[index];
          return (
            <li key={key} className="landing-trust-card">
              <span className="landing-trust-icon"><Icon aria-hidden="true" /></span>
              <p>{t(`trust.${key}`)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Testimonials;
