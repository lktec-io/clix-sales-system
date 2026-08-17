import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowRight } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';

const STAGGER_CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// A single, fixed platform headline — not six business-specific headlines
// swapped by a selector. BusinessTypes below is a self-contained grid of
// six cards, each with its own working "start trial" link; nothing here
// drives or reacts to it. The hero's job is to say what Clix is in one
// honest sentence, not to pre-brand itself around whichever business the
// visitor looks at first.
function Hero() {
  const { t } = useTranslation('landing');
  const shouldReduceMotion = useReducedMotion();

  // README FOR WHOEVER ADDS THE REAL ASSET:
  // Requires public/media/hero-product-demo.mp4 — a short (10-20s), silent,
  // looping screen-capture of the real product in action (dashboard KPIs,
  // POS sale, inventory list) at 1280x720 or similar 16:9, compressed for
  // web (target under 3MB). Until this file is added, the hero gracefully
  // falls back to the static preview panel below (no broken video box, no
  // console-visible failure to the visitor — onError below just flips this
  // flag once and the video layer stops rendering).
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <section className="landing-hero">
      {/* Full-bleed motion layer behind the entire hero (both the copy on
          the left and the preview card on the right) — not a small inset
          player. It sits purely behind .landing-hero-grid (z-index 1 below)
          via z-index 0, and is absolutely positioned inset:0 against
          .landing-hero's own already-sized box (padding + content define
          the section's height, never the video) — so there is no CLS
          whether the video loads, 404s, or is still deciding. Rendered only
          while !videoFailed; the section's own solid
          --landing-gradient-hero background (below, on .landing-hero
          itself) is the permanent fallback either way, so nothing ever
          looks "broken" or empty. */}
      {!videoFailed && (
        <div className="landing-hero-video-wrap" aria-hidden="true">
          <video
            className="landing-hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            onError={() => setVideoFailed(true)}
          >
            <source src="/media/hero-product-demo.mp4" type="video/mp4" />
          </video>
          {/* Same gradient the section already uses when there is no video,
              laid over the video at reduced opacity — keeps hero text at
              essentially the same contrast in both states instead of the
              raw video fighting with white text. */}
          <div className="landing-hero-video-overlay" />
        </div>
      )}

      <div className="landing-hero-texture" aria-hidden="true" />

      <motion.div
        className="landing-hero-grid"
        initial="hidden"
        animate="show"
        variants={STAGGER_CONTAINER}
      >
        <div className="landing-hero-copy">
          <motion.span className="landing-hero-eyebrow" variants={STAGGER_ITEM}>
            {t('hero.eyebrow')}
          </motion.span>

          <motion.h1 className="landing-hero-title" variants={STAGGER_ITEM}>
            {t('hero.title')}
          </motion.h1>

          <motion.p className="landing-hero-subtitle" variants={STAGGER_ITEM}>
            {t('hero.subtitle')}
          </motion.p>

          <motion.div className="landing-hero-actions" variants={STAGGER_ITEM}>
            <Link to={ROUTES.REGISTER} className="btn btn-primary btn-lg">
              {t('hero.ctaPrimary')} <FiArrowRight aria-hidden="true" />
            </Link>
            {/* A plain anchor, not react-router's <Link> — this is a same-page
                scroll to #business-types below, not a route change, and
                react-router's <Link to="#business-types"> does not reliably
                trigger the browser's native hash-scroll behavior. Matches
                LandingNav.jsx's own #pricing/#faq links, which use the same
                plain-<a> pattern. */}
            <a href="#business-types" className="btn btn-outline btn-lg">{t('hero.ctaSecondary')}</a>
          </motion.div>

          <motion.p className="landing-hero-note" variants={STAGGER_ITEM}>
            {t('hero.noCreditCard')}
          </motion.p>
        </div>

        <motion.div
          className="landing-hero-preview"
          variants={STAGGER_ITEM}
          animate={shouldReduceMotion ? undefined : { y: [0, -10, 0] }}
          transition={shouldReduceMotion ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="landing-hero-preview-titlebar">
            <span className="landing-hero-preview-dots" aria-hidden="true"><span /><span /><span /></span>
            <span className="landing-hero-preview-badge">
              <span className="landing-hero-preview-badge-dot" aria-hidden="true" />
              {t('hero.preview.badge')}
            </span>
          </div>

          <div className="landing-hero-preview-body">
            <div className="landing-hero-preview-stats">
              <div className="landing-hero-preview-stat">
                <span className="landing-hero-preview-stat-value">{t('hero.preview.statOneValue')}</span>
                <span className="landing-hero-preview-stat-label">{t('hero.preview.statOneLabel')}</span>
              </div>
              <div className="landing-hero-preview-stat">
                <span className="landing-hero-preview-stat-value">{t('hero.preview.statTwoValue')}</span>
                <span className="landing-hero-preview-stat-label">{t('hero.preview.statTwoLabel')}</span>
              </div>
              <div className="landing-hero-preview-stat">
                <span className="landing-hero-preview-stat-value">{t('hero.preview.statThreeValue')}</span>
                <span className="landing-hero-preview-stat-label">{t('hero.preview.statThreeLabel')}</span>
              </div>
            </div>
            <div className="landing-hero-preview-bars" aria-hidden="true">
              <span style={{ height: '46%' }} />
              <span style={{ height: '72%' }} />
              <span style={{ height: '58%' }} />
              <span style={{ height: '88%' }} />
              <span style={{ height: '64%' }} />
              <span style={{ height: '94%' }} />
            </div>
          </div>

          <div className="landing-hero-preview-footer">
            <span>{t('hero.preview.caption')}</span>
            <span className="landing-hero-preview-note">{t('hero.preview.note')}</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

export default Hero;
