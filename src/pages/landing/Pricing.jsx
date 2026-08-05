import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';

const PLAN_KEYS = ['trial', 'growth', 'enterprise'];

function Pricing() {
  const { t } = useTranslation('landing');

  return (
    <section id="pricing" className="landing-section landing-section-alt">
      <div className="landing-section-header">
        <h2>{t('pricing.title')}</h2>
        <p>{t('pricing.subtitle')}</p>
      </div>

      <div className="landing-pricing-grid">
        {PLAN_KEYS.map((key) => {
          const badge = t(`pricing.${key}.badge`, { defaultValue: '' });
          return (
            <div key={key} className={`landing-pricing-card ${key === 'growth' ? 'is-featured' : ''}`}>
              {badge && <span className="landing-pricing-badge">{badge}</span>}
              <h3>{t(`pricing.${key}.name`)}</h3>
              <div className="landing-pricing-amount">
                <span className="landing-pricing-price">{t(`pricing.${key}.price`)}</span>
                <span className="landing-pricing-period">{t(`pricing.${key}.period`)}</span>
              </div>
              <p className="landing-pricing-description">{t(`pricing.${key}.description`)}</p>
              <ul className="landing-pricing-features">
                {t(`pricing.${key}.features`, { returnObjects: true }).map((feature) => (
                  <li key={feature}><FiCheck aria-hidden="true" /> {feature}</li>
                ))}
              </ul>
              <Link
                to={ROUTES.REGISTER}
                className={`btn btn-block ${key === 'growth' ? 'btn-primary' : 'btn-outline'}`}
              >
                {t(`pricing.${key}.cta`)}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default Pricing;
