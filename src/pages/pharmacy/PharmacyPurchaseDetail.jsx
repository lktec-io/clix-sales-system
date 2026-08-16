import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import PageSkeleton from '../../components/common/PageSkeleton';
import * as pharmacyPurchaseService from '../../services/pharmacyPurchaseService';
import { formatCurrency } from '../../utils/formatCurrency';

function PharmacyPurchaseDetail() {
  const { t, i18n } = useTranslation(['pharmacy', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const load = useCallback(() => {
    setLoadError(false);
    setPurchase(null);
    pharmacyPurchaseService.getPurchase(id)
      .then(setPurchase)
      .catch(() => setLoadError(true));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching this purchase on mount/id-change is standard data-fetching, not derived state
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '50vh', gap: 'var(--space-4)' }}>
        <p className="text-secondary">{t('pharmacy:purchases.detail.loadError')}</p>
        <button type="button" className="btn btn-secondary" onClick={load}>
          <FiRefreshCw aria-hidden="true" /> {t('common:actions.retry')}
        </button>
      </div>
    );
  }

  if (!purchase) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/pharmacy/purchases')}>
            <FiArrowLeft aria-hidden="true" /> {t('pharmacy:purchases.detail.backToPurchases')}
          </button>
          <h1 className="page-title">{purchase.purchase_number}</h1>
          <p className="page-subtitle">
            {purchase.supplier_name} · {purchase.branch_name} · {formatDateTime(purchase.created_at)}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('pharmacy:purchases.detail.itemsTitle')}</span></div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('pharmacy:purchases.itemColumns.medicine')}</th>
                <th>{t('pharmacy:purchases.itemColumns.batch')}</th>
                <th>{t('pharmacy:purchases.itemColumns.expiryDate')}</th>
                <th>{t('pharmacy:purchases.itemColumns.quantity')}</th>
                <th>{t('pharmacy:purchases.itemColumns.buyingPrice')}</th>
                <th>{t('pharmacy:purchases.itemColumns.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.medicine_name}</td>
                  <td>{item.batch_number}</td>
                  <td>{formatDate(item.expiry_date)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.buying_price)}</td>
                  <td>{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer flex justify-end">
          <span className="text-lg font-semibold">{t('pharmacy:purchases.detail.totalLabel')}: {formatCurrency(purchase.total_amount)}</span>
        </div>
      </div>
    </div>
  );
}

export default PharmacyPurchaseDetail;
