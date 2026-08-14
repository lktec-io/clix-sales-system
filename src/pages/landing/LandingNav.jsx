import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiMenu, FiX } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';

function LandingNav() {
  const { t } = useTranslation('landing');
  const [open, setOpen] = useState(false);

  // Locks page scroll behind the mobile menu while it's open — without
  // this, a visitor could scroll the hero/sections underneath through the
  // fixed menu panel. Restored on close and on unmount, never left stuck.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <a href="#top" className="landing-brand" onClick={closeMenu}>Clix Sales System</a>

        {/* Dims and blocks the page behind the open mobile menu, and gives
            a click-outside-to-close target — a real backdrop, not just a
            dropdown floating over unblocked content. Desktop never renders
            this open (menu is always visible inline there), so it's inert
            above the 768px breakpoint. */}
        {open && <button type="button" className="landing-nav-overlay" aria-label="Close menu" onClick={closeMenu} />}

        <nav className={`landing-nav-links ${open ? 'is-open' : ''}`}>
          <a href="#demo" onClick={closeMenu}>{t('nav.howItWorks')}</a>
          <a href="#features" onClick={closeMenu}>{t('nav.features')}</a>
          <a href="#pricing" onClick={closeMenu}>{t('nav.pricing')}</a>
          <a href="#faq" onClick={closeMenu}>{t('nav.faq')}</a>
          <Link to={ROUTES.LOGIN} className="landing-nav-login" onClick={closeMenu}>{t('nav.login')}</Link>
          <Link to={ROUTES.REGISTER} className="btn btn-primary" onClick={closeMenu}>{t('nav.startTrial')}</Link>
        </nav>

        <button
          type="button"
          className="landing-nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? <FiX /> : <FiMenu />}
        </button>
      </div>
    </header>
  );
}

export default LandingNav;
