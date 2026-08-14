import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import * as billingService from '../../services/billingService';
import { formatCurrency } from '../../utils/formatCurrency';

// Real plans from subscription_plans (via the now-public GET /billing/plans
// — see backend/routes/billing.routes.js's comment on why that one route
// is registered ahead of authenticate()) — never hardcoded/mock pricing.
// Every tenant always starts on a free trial regardless of which plan
// they're looking at here, so every card's CTA points at the same
// Register flow rather than pre-selecting a paid plan at signup.
function Pricing() {
  const { t } = useTranslation('landing');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    billingService.getPlans()
      .then((data) => {
        if (!cancelled) setPlans(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="pricing" className="landing-section landing-section-alt">
      <div className="landing-section-header">
        <h2>{t('pricing.title')}</h2>
        <p>{t('pricing.subtitle')}</p>
      </div>

      {loading && (
        <p className="landing-pricing-status">{t('pricing.loading')}</p>
      )}

      {!loading && loadError && (
        <p className="landing-pricing-status">{t('pricing.loadError')}</p>
      )}

      {!loading && !loadError && (
        <div className="landing-pricing-grid">
          {plans.map((plan) => (
            <div key={plan.id} className={`landing-pricing-card ${plan.isRecommended ? 'is-featured' : ''}`}>
              {plan.isRecommended && <span className="landing-pricing-badge">{t('pricing.recommendedBadge')}</span>}
              <h3>{plan.name}</h3>
              <div className="landing-pricing-amount">
                <span className="landing-pricing-price">{formatCurrency(plan.priceMonthly, plan.currency)}</span>
                <span className="landing-pricing-period">{t('pricing.perMonth')}</span>
              </div>
              {plan.description && <p className="landing-pricing-description">{plan.description}</p>}
              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <ul className="landing-pricing-features">
                  {plan.features.map((feature) => (
                    <li key={feature}><FiCheck aria-hidden="true" /> {feature}</li>
                  ))}
                </ul>
              )}
              <Link
                to={ROUTES.REGISTER}
                className={`btn btn-block ${plan.isRecommended ? 'btn-primary' : 'btn-outline'}`}
              >
                {t('pricing.startTrialCta')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Pricing;
