import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

function SessionExpired() {
  const { t } = useTranslation('auth');
  const { acknowledgeSessionExpired } = useAuth();
  const navigate = useNavigate();

  const handleLoginAgain = () => {
    acknowledgeSessionExpired();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">{t('sessionExpired.title')}</h1>
      <p className="text-secondary text-sm mt-1 mb-4">
        {t('sessionExpired.message')}
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={handleLoginAgain}>
        {t('sessionExpired.loginAgain')}
      </button>
    </div>
  );
}

export default SessionExpired;
