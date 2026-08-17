import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCreditCard, FiClock, FiAlertCircle } from 'react-icons/fi';
import * as billingService from '../../services/billingService';
import { ROUTES } from '../../constants/routes';
import Skeleton from '../common/Skeleton';

const CRITICAL_STATUSES = ['expired', 'suspended'];
const ATTENTION_STATUSES = ['trial', 'grace_period', 'pending_payment'];

// The single, authoritative subscription/trial banner on the dashboard —
// covers every tenant_subscriptions.status value (trial, active,
// pending_payment, grace_period, expired, suspended, cancelled) in one
// place. Previously a separate TrialCard (trial/expired only) rendered
// directly above this one, so a trial tenant saw two "days remaining"
// messages and two "Upgrade Plan" buttons stacked on the same dashboard —
// TrialCard was removed rather than hidden, since its full behavior
// (urgency styling, days-remaining copy, upgrade CTA) is reproduced here.
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

  const isCritical = CRITICAL_STATUSES.includes(subscription.status)
    || (subscription.status === 'trial' && subscription.daysRemaining === 0);
  const needsAttention = isCritical || ATTENTION_STATUSES.includes(subscription.status);

  let Icon = FiCreditCard;
  if (isCritical) Icon = FiAlertCircle;
  else if (needsAttention) Icon = FiClock;

  const title = subscription.status === 'trial'
    ? t('card.trialTitle', { plan: subscription.planName })
    : t('card.title', { plan: subscription.planName });

  const message = subscription.daysRemaining !== null
    ? t('card.daysRemaining', { count: subscription.daysRemaining })
    : t('card.status', { status: t(`status.${subscription.status}`) });

  const cardClass = ['subscription-card'];
  if (isCritical) cardClass.push('subscription-card-critical');
  else if (needsAttention) cardClass.push('subscription-card-attention');

  return (
    <div className={cardClass.join(' ')}>
      <span className="subscription-card-icon" aria-hidden="true"><Icon /></span>
      <div className="subscription-card-body">
        <span className="subscription-card-title">{title}</span>
        <span className="subscription-card-message">{message}</span>
      </div>
      <Link to={ROUTES.BILLING} className="btn btn-primary subscription-card-cta">
        {needsAttention ? t('card.upgradePlan') : t('card.viewBilling')}
      </Link>
    </div>
  );
}

export default SubscriptionCard;
