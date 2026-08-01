import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';

function Forbidden403() {
  const { t } = useTranslation('errors');
  return (
    <>
      <div className="error-code">403</div>
      <h1 className="error-title">{t('forbidden.title')}</h1>
      <p className="error-message">
        {t('forbidden.message')}
      </p>
      <Link to={ROUTES.DASHBOARD} className="btn btn-primary error-action">
        {t('backToDashboard')}
      </Link>
    </>
  );
}

export default Forbidden403;
