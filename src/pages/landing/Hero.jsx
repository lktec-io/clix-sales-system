import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiShield, FiGlobe, FiGrid } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';

function Hero() {
  const { t } = useTranslation('landing');

  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <motion.span
          className="landing-hero-eyebrow"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {t('hero.eyebrow')}
        </motion.span>

        <motion.h1
          className="landing-hero-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {t('hero.title')}
        </motion.h1>

        <motion.p
          className="landing-hero-subtitle"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {t('hero.subtitle')}
        </motion.p>

        <motion.div
          className="landing-hero-actions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to={ROUTES.REGISTER} className="btn btn-primary btn-lg">{t('hero.ctaPrimary')}</Link>
          <Link to={ROUTES.LOGIN} className="btn btn-outline btn-lg">{t('hero.ctaSecondary')}</Link>
        </motion.div>

        <motion.p
          className="landing-hero-note"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {t('hero.noCreditCard')}
        </motion.p>

        <motion.div
          className="landing-hero-stats"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span><FiGrid aria-hidden="true" /> {t('hero.statBranches')}</span>
          <span><FiGlobe aria-hidden="true" /> {t('hero.statLanguages')}</span>
          <span><FiShield aria-hidden="true" /> {t('hero.statUptime')}</span>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;
