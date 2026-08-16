import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiEdit2, FiRefreshCw } from 'react-icons/fi';
import PageSkeleton from '../../components/common/PageSkeleton';
import EmptyState from '../../components/common/EmptyState';
import { usePermission } from '../../hooks/usePermission';
import * as medicineService from '../../services/medicineService';
import { formatCurrency } from '../../utils/formatCurrency';

function batchStatus(expiryDate) {
  const days = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
  if (days < 0) return { key: 'expired', badge: 'badge-danger' };
  if (days <= 30) return { key: 'expiring_soon', badge: 'badge-warning' };
  return { key: 'valid', badge: 'badge-success' };
}

const MOVEMENT_BADGE = { purchase: 'badge-success', sale: 'badge-info', adjustment: 'badge-neutral' };

function MedicineDetail() {
  const { t, i18n } = useTranslation(['pharmacy', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const canManage = usePermission('medicines.manage');
  const [medicine, setMedicine] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const load = useCallback(() => {
    setLoadError(false);
    setMedicine(null);
    medicineService.getMedicine(id)
      .then(setMedicine)
      .catch(() => setLoadError(true));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching this medicine on mount/id-change is standard data-fetching, not derived state
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '50vh', gap: 'var(--space-4)' }}>
        <p className="text-secondary">{t('pharmacy:medicines.detail.loadError')}</p>
        <button type="button" className="btn btn-secondary" onClick={load}>
          <FiRefreshCw aria-hidden="true" /> {t('common:actions.retry')}
        </button>
      </div>
    );
  }

  if (!medicine) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/medicines')}>
            <FiArrowLeft aria-hidden="true" /> {t('pharmacy:medicines.detail.backToMedicines')}
          </button>
          <h1 className="page-title">{medicine.name}</h1>
          <p className="page-subtitle">{medicine.category_name || '—'}</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(`/medicines/${id}/edit`)}>
              <FiEdit2 aria-hidden="true" /> {t('pharmacy:medicines.detail.edit')}
            </button>
          </div>
        )}
      </div>

      <div className="card mb-5">
        <div className="card-body">
          <div className="form-row">
            <div>
              <span className="text-xs text-secondary">{t('pharmacy:medicines.detail.currentStock')}</span>
              <div className="text-sm font-semibold">{medicine.current_stock} {medicine.unit}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('pharmacy:medicines.detail.reorderLevel')}</span>
              <div className="text-sm">{medicine.reorder_level} {medicine.unit}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('pharmacy:medicines.detail.sellingPrice')}</span>
              <div className="text-sm">{formatCurrency(medicine.selling_price)}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('pharmacy:medicines.detail.category')}</span>
              <div className="text-sm">{medicine.category_name || '—'}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('pharmacy:medicines.columns.status')}</span>
              <div><span className={`badge ${medicine.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{t(`pharmacy:medicines.status.${medicine.status}`)}</span></div>
            </div>
          </div>
          {medicine.description && <p className="text-sm text-secondary mt-3 mb-0">{medicine.description}</p>}
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('pharmacy:medicines.detail.batchesTitle')}</span></div>
        {medicine.batches.length === 0 ? (
          <div className="card-body"><EmptyState title={t('pharmacy:medicines.detail.noBatches')} /></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('pharmacy:medicines.detail.batchColumns.batchNumber')}</th>
                  <th>{t('pharmacy:medicines.detail.batchColumns.quantity')}</th>
                  <th>{t('pharmacy:medicines.detail.batchColumns.expiryDate')}</th>
                  <th>{t('pharmacy:medicines.detail.batchColumns.buyingPrice')}</th>
                  <th>{t('pharmacy:medicines.detail.batchColumns.status')}</th>
                </tr>
              </thead>
              <tbody>
                {medicine.batches.map((batch) => {
                  const status = batchStatus(batch.expiry_date);
                  return (
                    <tr key={batch.id}>
                      <td>{batch.batch_number}</td>
                      <td>{batch.quantity} {medicine.unit}</td>
                      <td>{formatDate(batch.expiry_date)}</td>
                      <td>{formatCurrency(batch.buying_price)}</td>
                      <td><span className={`badge ${status.badge}`}>{t(`pharmacy:expiry.status.${status.key}`)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('pharmacy:medicines.detail.movementsTitle')}</span></div>
        {medicine.recentMovements.length === 0 ? (
          <div className="card-body"><EmptyState title={t('pharmacy:medicines.detail.noMovements')} /></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('pharmacy:medicines.detail.movementColumns.date')}</th>
                  <th>{t('pharmacy:medicines.detail.movementColumns.type')}</th>
                  <th>{t('pharmacy:medicines.detail.movementColumns.batch')}</th>
                  <th>{t('pharmacy:medicines.detail.movementColumns.quantityChange')}</th>
                </tr>
              </thead>
              <tbody>
                {medicine.recentMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDateTime(movement.created_at)}</td>
                    <td><span className={`badge ${MOVEMENT_BADGE[movement.movement_type] || 'badge-neutral'}`}>{t(`pharmacy:medicines.detail.movementType.${movement.movement_type}`)}</span></td>
                    <td>{movement.batch_number || '—'}</td>
                    <td className={Number(movement.quantity_change) < 0 ? 'text-danger' : 'text-success'}>
                      {Number(movement.quantity_change) > 0 ? '+' : ''}{movement.quantity_change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default MedicineDetail;
