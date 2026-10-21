import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import * as billingService from '../../services/billingService';
import { formatCurrency } from '../../utils/formatCurrency';

const SKELETON_CARDS = 3;

// Yearly saving as a whole percentage, only when the plan's real yearly
// price is actually cheaper than twelve monthly payments.
function yearlySavingPercent(plan) {
  const twelveMonths = plan.priceMonthly * 12;
  if (!plan.priceYearly || !twelveMonths || plan.priceYearly >= twelveMonths) return 0;
  return Math.round((1 - plan.priceYearly / twelveMonths) * 100);
}

// Real plans from subscription_plans (public GET /billing/plans) — never
// mock pricing. The monthly/yearly toggle only switches which real price
// column is shown; every CTA still starts the same free-trial signup.
function Pricing() {
  const { t } = useTranslation('landing');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cycle, setCycle] = useState('monthly');

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

  const hasYearly = plans.some((plan) => plan.priceYearly > 0);
  const bestSaving = Math.max(0, ...plans.map(yearlySavingPercent));
  const isYearly = hasYearly && cycle === 'yearly';

  return (
    <section id="pricing" className="landing-section landing-section-alt">
      <div className="landing-section-eyebrow">02</div>
      <div className="landing-section-header">
        <h2>{t('pricing.title')}</h2>
        <p>{t('pricing.subtitle')}</p>
      </div>

      {hasYearly && (
        <div className="landing-billing-toggle">
          <div className="landing-billing-segment" role="group" aria-label={t('pricing.billingToggle')}>
            <button type="button" className="landing-billing-option" aria-pressed={!isYearly} onClick={() => setCycle('monthly')}>
              {t('pricing.monthly')}
            </button>
            <button type="button" className="landing-billing-option" aria-pressed={isYearly} onClick={() => setCycle('yearly')}>
              {t('pricing.yearly')}
              {bestSaving > 0 && <span className="landing-pricing-save">{t('pricing.saveUpTo', { percent: bestSaving })}</span>}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="landing-pricing-grid" aria-busy="true">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <div key={index} className="landing-pricing-skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {!loading && loadError && (
        <p className="landing-pricing-status">{t('pricing.loadError')}</p>
      )}

      {!loading && !loadError && (
        <div className="landing-pricing-grid">
          {plans.map((plan) => {
            const showYearly = isYearly && plan.priceYearly > 0;
            const saving = yearlySavingPercent(plan);
            return (
              <div key={plan.id} className={`landing-pricing-card ${plan.isRecommended ? 'is-featured' : ''}`}>
                {plan.isRecommended && <span className="landing-pricing-badge">{t('pricing.recommendedBadge')}</span>}
                <h3>{plan.name}</h3>
                <div className="landing-pricing-amount">
                  <span className="landing-pricing-price">
                    {formatCurrency(showYearly ? plan.priceYearly : plan.priceMonthly, plan.currency)}
                  </span>
                  <span className="landing-pricing-period">{showYearly ? t('pricing.perYear') : t('pricing.perMonth')}</span>
                </div>
                {showYearly && (
                  <p className="landing-pricing-subprice">
                    {t('pricing.monthlyEquivalent', { amount: formatCurrency(plan.priceYearly / 12, plan.currency) })}
                    {saving > 0 && <> <span className="landing-pricing-save">{t('pricing.save', { percent: saving })}</span></>}
                  </p>
                )}
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
                  className={`btn btn-block btn-lg ${plan.isRecommended ? 'btn-primary' : 'btn-outline'}`}
                >
                  {t('pricing.startTrialCta')}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default Pricing;
