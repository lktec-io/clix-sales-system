import { motion } from 'framer-motion';
import { FiGrid, FiList } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

// A small pill switch between "list" (table) and "grid" (card) rendering
// for a management page. The page itself owns the view state and swaps
// which of its two already-built render paths shows — this component is
// just the control, so no page's table/card markup has to be duplicated
// here. The active pill slides between the two options via a shared
// layoutId (the same pattern Sidebar.jsx uses for its active-link
// indicator), rather than a plain background-color swap.
function ViewToggle({ view, onChange }) {
  const { t } = useTranslation('common');
  return (
    <div className="view-toggle" role="group" aria-label={t('viewToggle.groupLabel')}>
      <button
        type="button"
        className={`view-toggle-btn view-toggle-btn-list ${view === 'list' ? 'view-toggle-btn-active' : ''}`}
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        aria-label={t('viewToggle.listView')}
      >
        {view === 'list' && (
          <motion.span
            layoutId="view-toggle-active-pill"
            className="view-toggle-active-pill"
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          />
        )}
        <FiList aria-hidden="true" />
        <span className="view-toggle-label">{t('viewToggle.list')}</span>
      </button>
      <button
        type="button"
        className={`view-toggle-btn view-toggle-btn-grid ${view === 'grid' ? 'view-toggle-btn-active' : ''}`}
        onClick={() => onChange('grid')}
        aria-pressed={view === 'grid'}
        aria-label={t('viewToggle.gridView')}
      >
        {view === 'grid' && (
          <motion.span
            layoutId="view-toggle-active-pill"
            className="view-toggle-active-pill"
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          />
        )}
        <FiGrid aria-hidden="true" />
        <span className="view-toggle-label">{t('viewToggle.grid')}</span>
      </button>
    </div>
  );
}

export default ViewToggle;
