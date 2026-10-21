import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCheck, FiArrowRight } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import { BUSINESS_THEMES } from '../../constants/businessThemes';
import { BUSINESS_PHOTOS } from '../../constants/landingMedia';
import styles from './BusinessTypes.module.css';

// The six business templates the platform actually ships (business_templates
// seed slugs). Each card: a real photo of that kind of business, what the
// template covers, and its own pre-scoped "start" link (?template= is read
// by Register.jsx).
const SLUGS = ['retail-store', 'cosmetics-shop', 'electronics-shop', 'microfinance', 'pharmacy', 'restaurant'];

function BusinessTypes() {
  const { t } = useTranslation('landing');

  return (
    <section id="business-types" className={styles.section}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>01</span>
        <h2 className={styles.heading}>{t('businessTypes.title')}</h2>
        <p className={styles.lead}>{t('businessTypes.subtitle')}</p>
      </div>

      <ul className={styles.grid} aria-label={t('businessTypes.groupLabel')}>
        {SLUGS.map((slug) => {
          const theme = BUSINESS_THEMES[slug];
          const photo = BUSINESS_PHOTOS[slug];
          const Icon = theme.icon;
          const capabilities = t(`businessTypes.${slug}.capabilities`, { returnObjects: true });

          return (
            <li key={slug} className={styles.card}>
              <figure className={styles.figure}>
                <img
                  className={styles.photo}
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 380px"
                  alt={t(`businessTypes.${slug}.photoAlt`)}
                  width="800"
                  height="533"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className={styles.credit}>
                  <a href={photo.credit.url} target="_blank" rel="noopener noreferrer">
                    {t('mediaCredit', { name: photo.credit.name, site: photo.credit.site })}
                  </a>
                </figcaption>
              </figure>

              <div className={styles.body}>
                <div className={styles.titleRow}>
                  <span className={styles.icon} aria-hidden="true"><Icon /></span>
                  <h3 className={styles.name}>{t(`businessTypes.${slug}.name`)}</h3>
                </div>
                <p className={styles.description}>{t(`businessTypes.${slug}.description`)}</p>
                {Array.isArray(capabilities) && (
                  <ul className={styles.tags}>
                    {capabilities.slice(0, 4).map((capability) => (
                      <li key={capability} className={styles.tag}><FiCheck aria-hidden="true" />{capability}</li>
                    ))}
                  </ul>
                )}
                <Link to={`${ROUTES.REGISTER}?template=${slug}`} className={styles.cta}>
                  {t('businessTypes.startCta')} <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default BusinessTypes;
