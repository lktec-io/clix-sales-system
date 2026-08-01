import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';

function NotFound404() {
  const { t } = useTranslation('errors');
  return (
    <>
      <div className="error-code">404</div>
      <h1 className="error-title">{t('notFound.title')}</h1>
      <p className="error-message">
        {t('notFound.message')}
      </p>
      <Link to={ROUTES.DASHBOARD} className="btn btn-primary error-action">
        {t('backToDashboard')}
      </Link>
    </>
  );
}

export default NotFound404;
