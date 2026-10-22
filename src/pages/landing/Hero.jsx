import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowRight, FiPlayCircle } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import { HERO_PORTRAIT, HERO_VIDEO } from '../../constants/landingMedia';
import styles from './Hero.module.css';

// Emerald hero: a short promise on the left; on the right a smiling merchant
// in a curved arch cut-out with a live checkout video overlapping it. All
// media is local (public/assets). If the video can't play, its poster stays.
function Hero() {
  const { t } = useTranslation('landing');
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <section className={styles.hero}>
      <span className={`${styles.glow} ${styles.glowA}`} aria-hidden="true" />
      <span className={`${styles.glow} ${styles.glowB}`} aria-hidden="true" />
      <span className={`${styles.glow} ${styles.glowC}`} aria-hidden="true" />

      <div className={styles.grid}>
        <div className={styles.copy}>
          <span className={`${styles.eyebrow} ${styles.enter}`}>{t('hero.eyebrow')}</span>
          <h1 className={`${styles.title} ${styles.enter}`}>{t('hero.title')}</h1>
          <p className={`${styles.subtitle} ${styles.enter}`}>{t('hero.subtitle')}</p>

          <div className={`${styles.actions} ${styles.enter}`}>
            <Link to={ROUTES.REGISTER} className={`btn btn-lg ${styles.ctaPrimary}`}>
              {t('hero.ctaPrimary')} <FiArrowRight aria-hidden="true" />
            </Link>
            {/* Plain anchor: a same-page scroll, not a route change. */}
            <a href="#business-types" className={`btn btn-lg ${styles.ctaSecondary}`}>{t('hero.ctaSecondary')}</a>
          </div>

          <p className={`${styles.note} ${styles.enter}`}>{t('hero.noCreditCard')}</p>
        </div>

        <div className={styles.visual}>
          <span className={styles.arch} aria-hidden="true" />

          <figure className={styles.portrait}>
            <img
              src={HERO_PORTRAIT.src}
              width={HERO_PORTRAIT.width}
              height={HERO_PORTRAIT.height}
              alt={t('hero.portraitAlt')}
              fetchPriority="high"
              decoding="async"
            />
          </figure>

          <figure className={styles.videoCard}>
            <div className={styles.videoFrame}>
              {videoFailed ? (
                <img className={styles.video} src={HERO_VIDEO.poster} alt={t('hero.videoAlt')} loading="lazy" />
              ) : (
                <video
                  className={styles.video}
                  poster={HERO_VIDEO.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  preload="metadata"
                  aria-label={t('hero.videoAlt')}
                  onError={() => setVideoFailed(true)}
                >
                  {HERO_VIDEO.sources.map((source) => (
                    <source key={source.src} src={source.src} type={source.type} media={source.media} />
                  ))}
                </video>
              )}
            </div>
            <figcaption className={styles.videoCaption}>
              <FiPlayCircle aria-hidden="true" /> {t('hero.videoCaption')}
            </figcaption>
          </figure>

          <span className={styles.badge}>
            <strong>6</strong> {t('hero.badge')}
          </span>
        </div>
      </div>
    </section>
  );
}

export default Hero;
