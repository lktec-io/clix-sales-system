import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiMenu, FiX, FiArrowRight, FiLogIn } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import styles from './LandingNav.module.css';

const SECTIONS = [
  { href: '#business-types', key: 'nav.businessTypes' },
  { href: '#pricing', key: 'nav.pricing' },
  { href: '#how-it-works', key: 'nav.howItWorks' },
];

// Sticky top bar. Desktop: inline links + Login + Start Trial. Mobile: a
// solid, opaque slide-in drawer (sections, then Start Trial with Login
// directly below) over a full-screen overlay. The header itself uses no
// backdrop-filter, so the fixed drawer is positioned against the viewport.
function LandingNav() {
  const { t } = useTranslation('landing');
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <a href="#top" className={styles.brand} onClick={closeMenu}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span>Clix Sales System</span>
        </a>

        <nav className={styles.desktopLinks} aria-label={t('nav.menuLabel')}>
          {SECTIONS.map((section) => (
            <a key={section.href} href={section.href} className={styles.link}>{t(section.key)}</a>
          ))}
        </nav>

        <div className={styles.desktopActions}>
          <Link to={ROUTES.LOGIN} className={styles.loginLink}>{t('nav.login')}</Link>
          <Link to={ROUTES.REGISTER} className="btn btn-primary">{t('nav.startTrial')}</Link>
        </div>

        <button
          type="button"
          className={styles.toggle}
          aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>
      </div>

      <div className={styles.overlay} data-open={open} onClick={closeMenu} aria-hidden="true" />

      <aside id="landing-mobile-menu" className={styles.drawer} data-open={open} inert={!open} aria-label={t('nav.menuLabel')}>
        <div className={styles.drawerHeader}>
          <span className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">C</span>
            <span>Clix Sales System</span>
          </span>
          <button type="button" className={styles.closeBtn} onClick={closeMenu} aria-label={t('nav.closeMenu')}>
            <FiX aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.drawerLinks}>
          {SECTIONS.map((section) => (
            <a key={section.href} href={section.href} className={styles.drawerLink} onClick={closeMenu}>
              {t(section.key)} <FiArrowRight aria-hidden="true" />
            </a>
          ))}
        </nav>

        <div className={styles.drawerActions}>
          <Link to={ROUTES.REGISTER} className="btn btn-primary btn-lg btn-block" onClick={closeMenu}>
            {t('nav.startTrial')}
          </Link>
          <Link to={ROUTES.LOGIN} className="btn btn-outline btn-lg btn-block" onClick={closeMenu}>
            <FiLogIn aria-hidden="true" /> {t('nav.login')}
          </Link>
        </div>
      </aside>
    </header>
  );
}

export default LandingNav;
