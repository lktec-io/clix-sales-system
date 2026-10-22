import { useTranslation } from 'react-i18next';
import { FiUsers } from 'react-icons/fi';
import styles from './TableMap.module.css';

const MAX_SEAT_DOTS = 12;

// Floor view of the restaurant's tables: one tile per table, coloured by
// live status, with a seat marker per cover. Purely presentational — the
// page passes its own table list and edit handler.
function TableMap({ tables, loading, onSelect }) {
  const { t } = useTranslation('restaurant');

  const counts = tables.reduce((acc, table) => {
    acc[table.status] = (acc[table.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className={styles.map} aria-label={t('tables.map.title')}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('tables.map.title')}</h2>
        <ul className={styles.legend}>
          {['available', 'occupied', 'reserved'].map((status) => (
            <li key={status} className={styles.legendItem} data-status={status}>
              <span className={styles.legendDot} aria-hidden="true" />
              {t(`tables.status.${status}`)}
              <span className={styles.legendCount}>{counts[status] || 0}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.floor} aria-busy={loading}>
        {loading && Array.from({ length: 8 }, (_, index) => (
          <span key={index} className={`skeleton ${styles.tileSkeleton}`} aria-hidden="true" />
        ))}

        {!loading && tables.length === 0 && <p className={styles.empty}>{t('tables.list.emptyMessage')}</p>}

        {!loading && tables.map((table) => {
          const seats = Math.max(1, Number(table.capacity) || 1);
          const inactive = table.is_active === 0 || table.is_active === false;
          return (
            <button
              key={table.id}
              type="button"
              className={styles.tile}
              data-status={table.status}
              data-inactive={inactive}
              onClick={onSelect ? () => onSelect(table) : undefined}
              disabled={!onSelect}
              aria-label={`${t('tables.map.table')} ${table.table_number} — ${t(`tables.status.${table.status}`)}, ${seats} ${t('tables.map.seats')}`}
            >
              <span className={styles.number}>{table.table_number}</span>
              <span className={styles.seats} aria-hidden="true">
                {Array.from({ length: Math.min(seats, MAX_SEAT_DOTS) }, (_, index) => <span key={index} className={styles.seat} />)}
              </span>
              <span className={styles.meta}>
                <FiUsers aria-hidden="true" /> {seats} · {t(`tables.status.${table.status}`)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default TableMap;
