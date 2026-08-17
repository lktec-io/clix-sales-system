import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCheck, FiArrowRight } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import { BUSINESS_THEMES } from '../../constants/businessThemes';

// The full, final six active templates — matches businessThemes.js's own
// key order, which itself matches business_templates' seeded slugs.
const SLUGS = ['retail-store', 'pharmacy', 'restaurant', 'microfinance', 'cosmetics-shop', 'electronics-shop'];

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

// Each card is a self-contained, non-interactive summary (icon/name/
// description/capability tags) with one real, working action: its own
// "Start free trial" link, pre-scoped to that business via the same
// ?template= query param Register.jsx already reads. There is no
// click-to-select/preview interaction anymore — that used to drive a
// ProductPreview section below (removed), so cards no longer need any
// click handling of their own.
function BusinessTypes() {
  const { t } = useTranslation('landing');

  return (
    <section id="business-types" className="landing-section">
      <div className="landing-section-eyebrow">01</div>
      <div className="landing-section-header">
        <h2>{t('businessTypes.title')}</h2>
        <p>{t('businessTypes.subtitle')}</p>
      </div>

      <motion.ul
        className="landing-business-grid"
        role="list"
        aria-label={t('businessTypes.groupLabel')}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        variants={STAGGER}
      >
        {SLUGS.map((slug) => {
          const theme = BUSINESS_THEMES[slug];
          const Icon = theme.icon;
          const capabilities = t(`businessTypes.${slug}.capabilities`, { returnObjects: true });

          return (
            <motion.li key={slug} className="landing-business-card-wrap" variants={ITEM}>
              <div
                className="landing-business-card"
                style={{ '--card-accent': theme.accent, '--card-accent-rgb': theme.accentRgb }}
              >
                <span className="landing-business-icon"><Icon aria-hidden="true" /></span>
                <span className="landing-business-name">{t(`businessTypes.${slug}.name`)}</span>
                <span className="landing-business-description">{t(`businessTypes.${slug}.description`)}</span>
                <span className="landing-business-tags">
                  {capabilities.slice(0, 3).map((capability) => (
                    <span key={capability} className="landing-business-tag"><FiCheck aria-hidden="true" />{capability}</span>
                  ))}
                </span>
              </div>

              <Link to={`${ROUTES.REGISTER}?template=${slug}`} className="landing-business-cta">
                {t('businessTypes.startCta')} <FiArrowRight aria-hidden="true" />
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}

export default BusinessTypes;
