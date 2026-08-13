import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiShield, FiGlobe, FiGrid } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import { BUSINESS_EXPERIENCES } from '../../constants/businessExperiences';

// Every active business template now has a dedicated hero identity (copy
// in landing:businessHero.<slug>.*, motif in BUSINESS_EXPERIENCES) — this
// is the full, final pill order, matching businessThemes.js's own key
// order. Retail Store is the default selection, mirroring the platform's
// own "Retail Store is the default template" convention
// (businessTemplateAssignment.service.js's DEFAULT_TEMPLATE_ID).
const SELECTOR_SLUGS = ['retail-store', 'pharmacy', 'restaurant', 'microfinance', 'cosmetics-shop', 'electronics-shop'];

function Hero() {
  const { t } = useTranslation('landing');
  const [activeSlug, setActiveSlug] = useState('retail-store');
  const experience = BUSINESS_EXPERIENCES[activeSlug];

  return (
    <section className="landing-hero landing-hero-business">
      <motion.div
        key={activeSlug}
        className={`business-motif ${experience.motifClass}`}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />

      <div className="landing-hero-inner">
        <div className="landing-hero-selector" role="group" aria-label={t('businessSelector.prompt')}>
          <span className="landing-hero-selector-label">{t('businessSelector.prompt')}</span>
          <div className="landing-hero-selector-pills">
            {SELECTOR_SLUGS.map((slug) => (
              <button
                key={slug}
                type="button"
                className={`landing-hero-pill ${activeSlug === slug ? 'is-active' : ''}`}
                onClick={() => setActiveSlug(slug)}
                aria-pressed={activeSlug === slug}
              >
                {t(`businessSelector.${slug}`)}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlug}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="landing-hero-eyebrow">{t(`businessHero.${activeSlug}.eyebrow`)}</span>
            <h1 className="landing-hero-title">{t(`businessHero.${activeSlug}.title`)}</h1>
            <p className="landing-hero-subtitle">{t(`businessHero.${activeSlug}.subtitle`)}</p>
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="landing-hero-actions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to={`${ROUTES.REGISTER}?template=${activeSlug}`} className="btn btn-primary btn-lg">{t('hero.ctaPrimary')}</Link>
          <Link to="#features" className="btn btn-outline btn-lg">{t(`businessHero.${activeSlug}.ctaSecondary`)}</Link>
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
          <span><FiGrid aria-hidden="true" /> {t(`businessHero.${activeSlug}.statOne`)}</span>
          <span><FiGlobe aria-hidden="true" /> {t(`businessHero.${activeSlug}.statTwo`)}</span>
          <span><FiShield aria-hidden="true" /> {t(`businessHero.${activeSlug}.statThree`)}</span>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;
