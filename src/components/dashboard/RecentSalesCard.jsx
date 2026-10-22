import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as saleService from '../../services/saleService';
import { formatCurrency } from '../../utils/formatCurrency';
import styles from './RecentSalesCard.module.css';

const ROWS = 6;
const STATUS_BADGE = { completed: 'badge-success', voided: 'badge-danger' };

// Dashboard bottom row: the latest POS sales with status pills. Reads the
// existing GET /sales list (newest first) — the same call Sale History uses.
function RecentSalesCard() {
  const { t, i18n } = useTranslation(['dashboard', 'sales']);
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    saleService
      .listSales({ page: 1, limit: ROWS })
      .then((result) => {
        if (!cancelled) setRows(result.items || []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatWhen = (iso) => new Date(iso).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <section className="card">
      <div className="card-header">
        <span className="card-title">{t('dashboard:recentOrdersTable.title')}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/pos/sales')}>
          {t('dashboard:recentOrdersTable.viewAll')}
        </button>
      </div>

      {failed ? (
        <div className="card-body text-sm text-secondary">{t('dashboard:recentOrdersTable.loadError')}</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('sales:columns.saleNumber')}</th>
                <th>{t('sales:columns.customer')}</th>
                <th>{t('sales:columns.cashier')}</th>
                <th>{t('sales:columns.date')}</th>
                <th className="cell-num">{t('sales:columns.amount')}</th>
                <th>{t('sales:columns.status')}</th>
              </tr>
            </thead>
            <tbody aria-busy={rows === null}>
              {rows === null && Array.from({ length: ROWS }, (_, index) => (
                <tr key={`skeleton-${index}`} aria-hidden="true">
                  {Array.from({ length: 6 }, (__, cell) => (
                    <td key={cell}><span className={`skeleton ${styles.skeletonCell}`} /></td>
                  ))}
                </tr>
              ))}

              {rows !== null && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>{t('dashboard:recentOrdersTable.empty')}</td>
                </tr>
              )}

              {rows !== null && rows.map((sale) => (
                <tr key={sale.id} className="table-row-clickable" onClick={() => navigate(`/pos/sales/${sale.id}`)}>
                  <td className={styles.code}>{sale.sale_number}</td>
                  <td>{sale.customer_first_name ? `${sale.customer_first_name} ${sale.customer_last_name || ''}` : t('dashboard:recentOrdersTable.walkIn')}</td>
                  <td>{sale.cashier_first_name} {sale.cashier_last_name}</td>
                  <td className={styles.when}>{formatWhen(sale.created_at)}</td>
                  <td className="cell-num">{formatCurrency(sale.total_amount)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[sale.status] || 'badge-neutral'}`}>
                      {t(`sales:status.${sale.status}`, { defaultValue: sale.status })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RecentSalesCard;
