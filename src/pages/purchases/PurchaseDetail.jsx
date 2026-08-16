import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import PageSkeleton from '../../components/common/PageSkeleton';
import TypedConfirmDialog from '../../components/common/TypedConfirmDialog';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as purchaseService from '../../services/purchaseService';
import { formatCurrency } from '../../utils/formatCurrency';

function PurchaseDetail() {
  const { t, i18n } = useTranslation(['purchases', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canDelete = usePermission('purchases.delete');
  const [purchase, setPurchase] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  // A previous version left this fetch's rejection completely unhandled —
  // any failure (404 for a stale/bad id, a permission error, a network
  // hiccup) meant `purchase` stayed null forever and the page sat on
  // <PageSkeleton/> indefinitely with no way out. Every branch below now
  // terminates the loading state one way or another.
  const load = useCallback(() => {
    setLoadError(false);
    setPurchase(null);
    purchaseService.getPurchase(id)
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
        <p className="text-secondary">{t('purchases:detail.loadError')}</p>
        <button type="button" className="btn btn-secondary" onClick={load}>
          <FiRefreshCw aria-hidden="true" /> {t('common:actions.retry')}
        </button>
      </div>
    );
  }

  if (!purchase) {
    return <PageSkeleton />;
  }

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await purchaseService.deletePurchase(purchase.id);
      toast.success(t('purchases:list.deleteSuccess'));
      navigate('/purchases', { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.message || t('purchases:list.deleteError'));
      throw err;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/purchases')}>
            <FiArrowLeft aria-hidden="true" /> {t('purchases:detail.backToPurchases')}
          </button>
          <h1 className="page-title">{purchase.purchase_number}</h1>
          <p className="page-subtitle">
            {purchase.supplier_name} · {purchase.branch_name} · {formatDateTime(purchase.created_at)}
          </p>
        </div>
        {canDelete && (
          <div className="page-actions">
            <button type="button" className="btn btn-danger" onClick={() => { setDeleteError(''); setDeleteOpen(true); }}>
              <FiTrash2 aria-hidden="true" /> {t('purchases:list.deletePurchase')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('purchases:detail.itemsTitle')}</span></div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('purchases:itemColumns.product')}</th>
                <th>{t('purchases:itemColumns.quantity')}</th>
                <th>{t('purchases:itemColumns.buyingPrice')}</th>
                <th>{t('purchases:itemColumns.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name}<div className="text-xs text-secondary">{item.product_code}</div></td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.buying_price)}</td>
                  <td>{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer flex justify-end">
          <span className="text-lg font-semibold">{t('purchases:detail.totalLabel')}: {formatCurrency(purchase.total_amount)}</span>
        </div>
      </div>

      <TypedConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('purchases:list.deleteDialogTitle')}
        message={t('purchases:list.deleteDialogMessage', { number: purchase.purchase_number })}
        confirmLabel={t('purchases:list.deletePermanently')}
        error={deleteError}
      />
    </div>
  );
}

export default PurchaseDetail;
