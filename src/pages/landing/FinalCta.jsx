import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowRight } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';

// The page's closing pitch — deliberately plain (no new claims, no new
// data) since everything it needs to say has already been earned by the
// sections above it. Both links are real routes, matching every other CTA
// on this page.
function FinalCta() {
  const { t } = useTranslation('landing');

  return (
    <section id="get-started" className="landing-final-cta">
      <motion.div
        className="landing-final-cta-inner"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2>{t('finalCta.title')}</h2>
        <p>{t('finalCta.subtitle')}</p>
        <div className="landing-final-cta-actions">
          <Link to={ROUTES.REGISTER} className="btn btn-primary btn-lg">
            {t('finalCta.cta')} <FiArrowRight aria-hidden="true" />
          </Link>
          <span className="landing-final-cta-login">
            {t('finalCta.loginPrompt')} <Link to={ROUTES.LOGIN}>{t('finalCta.loginLink')}</Link>
          </span>
        </div>
      </motion.div>
    </section>
  );
}

export default FinalCta;
