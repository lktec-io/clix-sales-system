import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import { HERO_VIDEO } from '../../constants/landingMedia';
import styles from './Hero.module.css';

// Clean, light hero: the promise on the left, a real HTML5 video of a
// merchant serving a customer at a POS counter on the right. If the video
// can't load, the poster frame stays in place — never an empty box.
function Hero() {
  const { t } = useTranslation('landing');
  const [videoFailed, setVideoFailed] = useState(false);
  const points = t('hero.points', { returnObjects: true });

  return (
    <section className={styles.hero}>
      <div className={styles.grid}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>{t('hero.eyebrow')}</span>
          <h1 className={styles.title}>{t('hero.title')}</h1>
          <p className={styles.subtitle}>{t('hero.subtitle')}</p>

          {Array.isArray(points) && (
            <ul className={styles.points}>
              {points.map((point) => (
                <li key={point}><FiCheckCircle aria-hidden="true" /> {point}</li>
              ))}
            </ul>
          )}

          <div className={styles.actions}>
            <Link to={ROUTES.REGISTER} className="btn btn-success btn-lg">
              {t('hero.ctaPrimary')} <FiArrowRight aria-hidden="true" />
            </Link>
            {/* Plain anchor: a same-page scroll, not a route change. */}
            <a href="#business-types" className="btn btn-outline btn-lg">{t('hero.ctaSecondary')}</a>
          </div>

          <p className={styles.note}>{t('hero.noCreditCard')}</p>
        </div>

        <figure className={styles.media}>
          <div className={styles.player}>
            {videoFailed ? (
              <img className={styles.video} src={HERO_VIDEO.poster} alt={t('hero.videoAlt')} />
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
          <figcaption className={styles.caption}>
            <span>{t('hero.videoCaption')}</span>
            <a href={HERO_VIDEO.credit.url} target="_blank" rel="noopener noreferrer" className={styles.credit}>
              {t('mediaCredit', { name: HERO_VIDEO.credit.name, site: HERO_VIDEO.credit.site })}
            </a>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export default Hero;
