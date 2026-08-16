import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiUserPlus, FiGrid, FiClock, FiPlayCircle } from 'react-icons/fi';

const STEP_ICONS = { step1: FiUserPlus, step2: FiGrid, step3: FiClock, step4: FiPlayCircle };
const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'];

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// The real, actual signup sequence — register, pick a template, the trial
// engine starts automatically (TRIAL_DAYS = 7 server-side), then work
// begins. No invented steps (no "book a demo," no "talk to sales" — this
// product has neither).
function HowItWorks() {
  const { t } = useTranslation('landing');

  return (
    <section id="how-it-works" className="landing-section">
      <div className="landing-section-eyebrow">05</div>
      <div className="landing-section-header">
        <h2>{t('howItWorks.title')}</h2>
        <p>{t('howItWorks.subtitle')}</p>
      </div>

      <motion.ol
        className="landing-steps"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={STAGGER}
      >
        {STEP_KEYS.map((key, index) => {
          const Icon = STEP_ICONS[key];
          return (
            <motion.li key={key} className="landing-step" variants={ITEM}>
              <span className="landing-step-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="landing-step-icon"><Icon aria-hidden="true" /></span>
              <h3>{t(`howItWorks.${key}.title`)}</h3>
              <p>{t(`howItWorks.${key}.description`)}</p>
            </motion.li>
          );
        })}
      </motion.ol>
    </section>
  );
}

export default HowItWorks;
