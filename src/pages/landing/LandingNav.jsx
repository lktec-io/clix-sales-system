import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiMenu, FiX } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';

function LandingNav() {
  const { t } = useTranslation('landing');
  const [open, setOpen] = useState(false);

  return (
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <span className="landing-brand">Clix Sales System</span>

        <nav className={`landing-nav-links ${open ? 'is-open' : ''}`}>
          <a href="#features" onClick={() => setOpen(false)}>{t('nav.features')}</a>
          <a href="#pricing" onClick={() => setOpen(false)}>{t('nav.pricing')}</a>
          <a href="#faq" onClick={() => setOpen(false)}>{t('nav.faq')}</a>
          <Link to={ROUTES.LOGIN} className="landing-nav-login" onClick={() => setOpen(false)}>{t('nav.login')}</Link>
          <Link to={ROUTES.REGISTER} className="btn btn-primary" onClick={() => setOpen(false)}>{t('nav.startTrial')}</Link>
        </nav>

        <button
          type="button"
          className="landing-nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? <FiX /> : <FiMenu />}
        </button>
      </div>
    </header>
  );
}

export default LandingNav;
