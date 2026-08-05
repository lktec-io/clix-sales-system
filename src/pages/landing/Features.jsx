import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiShoppingCart, FiPackage, FiTruck, FiBarChart2, FiGrid, FiGlobe } from 'react-icons/fi';

const FEATURE_ICONS = {
  pos: FiShoppingCart,
  inventory: FiPackage,
  purchases: FiTruck,
  reports: FiBarChart2,
  multiBranch: FiGrid,
  bilingual: FiGlobe,
};

const FEATURE_KEYS = ['pos', 'inventory', 'purchases', 'reports', 'multiBranch', 'bilingual'];

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function Features() {
  const { t } = useTranslation('landing');

  return (
    <section id="features" className="landing-section">
      <div className="landing-section-header">
        <h2>{t('features.title')}</h2>
        <p>{t('features.subtitle')}</p>
      </div>

      <motion.div
        className="landing-features-grid"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={STAGGER}
      >
        {FEATURE_KEYS.map((key) => {
          const Icon = FEATURE_ICONS[key];
          return (
            <motion.div key={key} className="landing-feature-card" variants={ITEM}>
              <span className="landing-feature-icon"><Icon aria-hidden="true" /></span>
              <h3>{t(`features.${key}.title`)}</h3>
              <p>{t(`features.${key}.description`)}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

export default Features;
