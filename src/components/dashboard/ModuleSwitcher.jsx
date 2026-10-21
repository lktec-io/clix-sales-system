import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../hooks/useCompany';
import { useModules } from '../../hooks/useModules';
import { useNavigationItems } from '../../hooks/useNavigationItems';
import styles from './ModuleSwitcher.module.css';

const cx = (...classNames) => classNames.filter(Boolean).join(' ');

// Context header for the dashboard: which business this workspace runs and
// a pill row to jump straight into any module its subscription enables.
// The pills are the same permission-filtered list the sidebar shows, so a
// module the tenant's template doesn't include never appears here.
function ModuleSwitcher() {
  const { t } = useTranslation(['sidebar', 'landing']);
  const { company } = useCompany();
  const { businessTemplateSlug } = useModules();
  const { loading, mainItems } = useNavigationItems();

  const templateLabel = businessTemplateSlug
    ? t(`landing:businessTypes.${businessTemplateSlug}.name`, { defaultValue: '' })
    : '';

  if (!loading && mainItems.length === 0) return null;

  return (
    <section className={styles.switcher} aria-label={t('sidebar:moduleSwitcher.label')}>
      <div className={styles.context}>
        <span className={styles.eyebrow}>{templateLabel || t('sidebar:moduleSwitcher.label')}</span>
        {company?.company_name && <span className={styles.company}>{company.company_name}</span>}
      </div>

      <nav className={styles.pills} aria-label={t('sidebar:moduleSwitcher.label')}>
        {loading
          ? Array.from({ length: 5 }, (_, index) => <span key={index} className={cx(styles.pillSkeleton, styles.shimmer)} aria-hidden="true" />)
          : mainItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cx(styles.pill, isActive && styles.pillActive)}
            >
              <Icon className={styles.pillIcon} aria-hidden="true" />
              <span className={styles.pillLabel}>{label}</span>
            </NavLink>
          ))}
      </nav>
    </section>
  );
}

export default ModuleSwitcher;
