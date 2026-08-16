import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiLayers, FiGlobe, FiGrid, FiShield } from 'react-icons/fi';

const BENEFIT_ICONS = { item1: FiLayers, item2: FiGlobe, item3: FiGrid, item4: FiShield };
const BENEFIT_KEYS = ['item1', 'item2', 'item3', 'item4'];

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// A short, focused set of outcomes — deliberately four cards, not the
// six-item generic module dump (POS/Inventory/Purchases/Reports/
// Multi-Branch/Bilingual) this section replaces. Business-specific module
// detail already lives in BusinessTypes/ProductPreview above; this section
// answers "why this system" once, platform-wide, and stops.
function Benefits() {
  const { t } = useTranslation('landing');

  return (
    <section id="platform" className="landing-section">
      <div className="landing-section-eyebrow">03</div>
      <div className="landing-section-header">
        <h2>{t('benefits.title')}</h2>
        <p>{t('benefits.subtitle')}</p>
      </div>

      <motion.div
        className="landing-benefits-grid"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={STAGGER}
      >
        {BENEFIT_KEYS.map((key) => {
          const Icon = BENEFIT_ICONS[key];
          return (
            <motion.div key={key} className="landing-benefit-card" variants={ITEM}>
              <span className="landing-benefit-icon"><Icon aria-hidden="true" /></span>
              <h3>{t(`benefits.${key}.title`)}</h3>
              <p>{t(`benefits.${key}.description`)}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

export default Benefits;
