import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FiClock, FiAlertCircle } from 'react-icons/fi';
import * as tenantService from '../../services/tenantService';
import { ROUTES } from '../../constants/routes';
import Skeleton from '../common/Skeleton';

function daysRemaining(trialEndsAt) {
  if (!trialEndsAt) return 0;
  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 86400000));
}

// Never blocks the dashboard — a failed fetch or an active/cancelled
// subscription both just render nothing, same as "loading" briefly does.
// Only 'trial' and 'expired' tenants see this card at all; a paying
// customer's dashboard stays uncluttered.
function TrialCard() {
  const { t } = useTranslation('dashboard');
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    tenantService.getMyTenant()
      .then((data) => {
        if (!cancelled) setTenant(data);
      })
      .catch(() => {
        // Trial status is a nice-to-have banner, never a reason to break the dashboard.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton height={72} />;
  if (!tenant || !['trial', 'expired'].includes(tenant.subscriptionStatus)) return null;

  const isExpired = tenant.subscriptionStatus === 'expired' || daysRemaining(tenant.trialEndsAt) === 0;
  const remaining = daysRemaining(tenant.trialEndsAt);

  return (
    <div className={`trial-card ${isExpired ? 'trial-card-expired' : ''}`}>
      <span className="trial-card-icon" aria-hidden="true">
        {isExpired ? <FiAlertCircle /> : <FiClock />}
      </span>
      <div className="trial-card-body">
        <span className="trial-card-title">
          {isExpired ? t('trial.expiredTitle') : t('trial.title')}
        </span>
        <span className="trial-card-message">
          {isExpired
            ? t('trial.expiredMessage')
            : t('trial.daysRemaining', { count: remaining })}
        </span>
      </div>
      <Link to={ROUTES.BILLING} className="btn btn-primary trial-card-cta">{t('trial.upgradePlan')}</Link>
    </div>
  );
}

export default TrialCard;
