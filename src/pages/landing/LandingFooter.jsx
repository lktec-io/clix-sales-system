import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';

function LandingFooter() {
  const { t } = useTranslation('landing');
  const year = new Date().getFullYear();

  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <span className="landing-brand">Clix Sales System</span>
          <p>{t('footer.tagline')}</p>
        </div>

        <div className="landing-footer-links">
          <div>
            <span className="landing-footer-heading">{t('footer.product')}</span>
            {/* No "Platform" link here — its target (id="platform",
                Benefits.jsx) was removed, and repointing it to
                #business-types would just duplicate the link right below.
                nav.platform's i18n key is intentionally left in place
                (unused) rather than deleted, per this pass's "don't remove
                other translation keys" scope. */}
            <a href="#business-types">{t('nav.businessTypes')}</a>
            <a href="#pricing">{t('nav.pricing')}</a>
            <a href="#how-it-works">{t('nav.howItWorks')}</a>
          </div>
          <div>
            <span className="landing-footer-heading">{t('footer.company')}</span>
            <Link to={ROUTES.LOGIN}>{t('nav.login')}</Link>
            <Link to={ROUTES.REGISTER}>{t('nav.startTrial')}</Link>
          </div>
        </div>
      </div>

      <div className="landing-footer-bottom">
        <span>&copy; {year} Clix Digital Works. {t('footer.rights')}</span>
      </div>
    </footer>
  );
}

export default LandingFooter;
