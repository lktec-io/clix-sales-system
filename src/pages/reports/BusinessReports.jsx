import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiFileText } from 'react-icons/fi';
import EmptyState from '../../components/common/EmptyState';
import RetailReport from '../../components/reports/RetailReport';
import RepairReport from '../../components/reports/RepairReport';
import RestaurantReport from '../../components/reports/RestaurantReport';
import LoanReport from '../../components/reports/LoanReport';
import PharmacyReport from '../../components/reports/PharmacyReport';
import { useAuth } from '../../hooks/useAuth';
import { useModules } from '../../hooks/useModules';
import { availableBusinessReports } from '../../constants/businessReports';
import styles from './BusinessReports.module.css';

function renderReport(key) {
  switch (key) {
    case 'retail': return <RetailReport />;
    case 'cosmetics': return <RetailReport cosmetics />;
    case 'repair': return <RepairReport />;
    case 'restaurant': return <RestaurantReport />;
    case 'loans': return <LoanReport />;
    case 'pharmacy': return <PharmacyReport />;
    default: return null;
  }
}

// One report per business module this tenant runs — each computed in the
// browser from that module's own records. Tabs appear only when a template
// enables more than one module.
function BusinessReports() {
  const { t } = useTranslation('reports');
  const { hasPermission } = useAuth();
  const { isModuleEnabled, businessTemplateSlug, loading } = useModules();
  const reports = availableBusinessReports({ isModuleEnabled, hasPermission, businessTemplateSlug });
  const [selected, setSelected] = useState(null);
  const active = reports.find((r) => r.key === selected) || reports[0];

  if (loading) return <div className={`skeleton ${styles.pageSkeleton}`} aria-hidden="true" />;

  if (!active) {
    return <EmptyState icon={FiFileText} title={t('business.noneTitle')} description={t('business.noneDescription')} />;
  }

  return (
    <div className={styles.page}>
      {reports.length > 1 && (
        <nav className={`${styles.tabs} no-print`} aria-label={t('business.tabsLabel')}>
          {reports.map(({ key, icon: Icon }) => (
            <button key={key} type="button" className={styles.tab} aria-pressed={active.key === key} onClick={() => setSelected(key)}>
              <Icon aria-hidden="true" /> {t(`business.tabs.${key}`)}
            </button>
          ))}
        </nav>
      )}
      {renderReport(active.key)}
    </div>
  );
}

export default BusinessReports;
