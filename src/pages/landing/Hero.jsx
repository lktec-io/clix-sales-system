import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiShield, FiGlobe, FiGrid } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import { BUSINESS_EXPERIENCES } from '../../constants/businessExperiences';

// Order matters — this is the pill order rendered below. 'general' is the
// default (no business-specific motif/copy), matching the platform's own
// Retail-Store-is-the-default convention (businessTemplateAssignment
// .service.js's DEFAULT_TEMPLATE_ID).
const SELECTOR_SLUGS = ['general', 'electronics-shop', 'cosmetics-shop', 'restaurant'];

function Hero() {
  const { t } = useTranslation('landing');
  const [activeSlug, setActiveSlug] = useState('general');
  const experience = BUSINESS_EXPERIENCES[activeSlug] || null;
  const isBusinessSelected = activeSlug !== 'general';

  const eyebrow = isBusinessSelected ? t(`businessHero.${activeSlug}.eyebrow`) : t('hero.eyebrow');
  const title = isBusinessSelected ? t(`businessHero.${activeSlug}.title`) : t('hero.title');
  const subtitle = isBusinessSelected ? t(`businessHero.${activeSlug}.subtitle`) : t('hero.subtitle');
  const ctaSecondaryLabel = isBusinessSelected ? t(`businessHero.${activeSlug}.ctaSecondary`) : t('hero.ctaSecondary');
  const statOne = isBusinessSelected ? t(`businessHero.${activeSlug}.statOne`) : t('hero.statBranches');
  const statTwo = isBusinessSelected ? t(`businessHero.${activeSlug}.statTwo`) : t('hero.statLanguages');
  const statThree = isBusinessSelected ? t(`businessHero.${activeSlug}.statThree`) : t('hero.statUptime');
  // "Log In" only makes sense as the secondary CTA in the general state —
  // once a business is picked, the secondary CTA becomes "See how it
  // works" style copy pointing at Features instead, matching the master
  // prompt's per-business secondary-CTA spec. Login is still reachable
  // from LandingNav in both states.
  const secondaryHref = isBusinessSelected ? '#features' : ROUTES.LOGIN;
  const registerHref = isBusinessSelected ? `${ROUTES.REGISTER}?template=${activeSlug}` : ROUTES.REGISTER;

  return (
    <section className={`landing-hero ${isBusinessSelected ? 'landing-hero-business' : ''}`}>
      {experience && (
        <motion.div
          key={activeSlug}
          className={`business-motif ${experience.motifClass}`}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
      )}

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
            <span className="landing-hero-eyebrow">{eyebrow}</span>
            <h1 className="landing-hero-title">{title}</h1>
            <p className="landing-hero-subtitle">{subtitle}</p>
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="landing-hero-actions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to={registerHref} className="btn btn-primary btn-lg">{t('hero.ctaPrimary')}</Link>
          <Link to={secondaryHref} className="btn btn-outline btn-lg">{ctaSecondaryLabel}</Link>
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
          <span><FiGrid aria-hidden="true" /> {statOne}</span>
          <span><FiGlobe aria-hidden="true" /> {statTwo}</span>
          <span><FiShield aria-hidden="true" /> {statThree}</span>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;
