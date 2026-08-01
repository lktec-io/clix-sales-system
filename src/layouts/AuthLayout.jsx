import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../hooks/useCompany';
import PageTransition from '../components/common/PageTransition';
import '../styles/pages/AuthLayout.css';

function AuthLayout() {
  const { t } = useTranslation('auth');
  const { company } = useCompany();
  const companyName = company?.company_name || 'Clix';

  return (
    <div className="auth-shell">
      <div className="auth-card fade-in">
        <div className="auth-brand">
          {company?.logo_path ? (
            <motion.div
              className="auth-brand-logo-wrap"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.img
                src={company.logo_path}
                alt={companyName}
                className="auth-brand-logo"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          ) : (
            <span className="auth-brand-mark">{companyName}</span>
          )}
          <span className="auth-brand-sub">{t('brand.tagline')}</span>
        </div>
        <PageTransition />
      </div>
    </div>
  );
}

export default AuthLayout;
