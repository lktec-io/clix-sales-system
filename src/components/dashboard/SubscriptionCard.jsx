import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCreditCard } from 'react-icons/fi';
import * as billingService from '../../services/billingService';
import { ROUTES } from '../../constants/routes';
import Skeleton from '../common/Skeleton';

// Sibling to TrialCard.jsx, not an edit to it — TrialCard only renders for
// trial/expired tenants and stays untouched from Phase 2. This card renders
// for every tenant regardless of status (Step 10 wants Current Plan/Status/
// Renewal/Days Remaining visible always, not just during a trial).
function SubscriptionCard() {
  const { t } = useTranslation('billing');
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    billingService.getMySubscription()
      .then((data) => {
        if (!cancelled) setSubscription(data);
      })
      .catch(() => {
        // Billing status is a nice-to-have card, never a reason to break the dashboard.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton height={72} />;
  if (!subscription) return null;

  return (
    <div className="subscription-card">
      <span className="subscription-card-icon" aria-hidden="true"><FiCreditCard /></span>
      <div className="subscription-card-body">
        <span className="subscription-card-title">{t('card.title', { plan: subscription.planName })}</span>
        <span className="subscription-card-message">
          {subscription.daysRemaining !== null
            ? t('card.daysRemaining', { count: subscription.daysRemaining })
            : t('card.status', { status: t(`status.${subscription.status}`) })}
        </span>
      </div>
      <Link to={ROUTES.BILLING} className="btn btn-secondary subscription-card-link">{t('card.viewBilling')}</Link>
      <Link to={ROUTES.BILLING} className="btn btn-primary subscription-card-cta">{t('card.upgradePlan')}</Link>
    </div>
  );
}

export default SubscriptionCard;
