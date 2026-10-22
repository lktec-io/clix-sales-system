import { useTranslation } from 'react-i18next';
import { FiCheckCircle } from 'react-icons/fi';
import { useCompany } from '../hooks/useCompany';
import PageTransition from '../components/common/PageTransition';
import styles from './AuthLayout.module.css';

const BRAND_NAME = 'Clix Sales System';

// Two-panel authentication layout shared by Login, Register, Forgot/Reset
// password and Session Expired. Left: a welcoming brand panel with the
// product's real highlights. Right: the form. On phones the brand panel
// collapses to a compact header so the form is immediately usable.
function AuthLayout() {
  const { t } = useTranslation('auth');
  const { company } = useCompany();
  const highlights = t('panel.highlights', { returnObjects: true });
  const stats = t('panel.stats', { returnObjects: true });

  return (
    <div className={styles.shell}>
      <aside className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <span className={styles.logoMark} aria-hidden="true">C</span>
          <span className={styles.brandName}>{BRAND_NAME}</span>
        </div>

        <div className={styles.brandBody}>
          <h2 className={styles.brandTitle}>{t('panel.title')}</h2>
          <p className={styles.brandText}>{t('panel.subtitle')}</p>

          {Array.isArray(highlights) && (
            <ul className={styles.highlights}>
              {highlights.map((item) => (
                <li key={item}><FiCheckCircle aria-hidden="true" /> {item}</li>
              ))}
            </ul>
          )}
        </div>

        {Array.isArray(stats) && (
          <dl className={styles.stats}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <dt className={styles.statLabel}>{stat.label}</dt>
                <dd className={styles.statValue}>{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </aside>

      <main className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.formBrand}>
            {company?.logo_path ? (
              <img src={company.logo_path} alt={company.company_name || BRAND_NAME} className={styles.companyLogo} />
            ) : (
              <span className={styles.formBrandName}>{BRAND_NAME}</span>
            )}
            <span className={styles.formBrandSub}>{t('brand.tagline')}</span>
          </div>
          <PageTransition />
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
