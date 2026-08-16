import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageSkeleton from '../../components/common/PageSkeleton';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as returnService from '../../services/returnService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
};

function ReturnDetail() {
  const { t, i18n } = useTranslation(['returns', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const canApprove = usePermission('returns.approve');
  const toast = useToast();
  const [returnRecord, setReturnRecord] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [actionError, setActionError] = useState('');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const REASON_LABELS = {
    damaged: t('returns:reasons.damaged'),
    wrong_item: t('returns:reasons.wrongItem'),
    changed_mind: t('returns:reasons.changedMind'),
    expired: t('returns:reasons.expired'),
    other: t('returns:reasons.other'),
  };

  const STATUS_LABELS = {
    pending: t('returns:status.pending'),
    approved: t('returns:status.approved'),
    rejected: t('returns:status.rejected'),
  };

  const REFUND_METHOD_LABELS = {
    cash: t('returns:refundMethod.cash'),
    mpesa: t('returns:refundMethod.mpesa'),
    airtel_money: t('returns:refundMethod.airtelMoney'),
    bank_transfer: t('returns:refundMethod.bankTransfer'),
  };

  const REFUND_STATUS_LABELS = {
    refunded: t('returns:refundStatus.refunded'),
    pending: t('returns:refundStatus.pending'),
  };

  const loadReturn = useCallback(() => {
    setLoadError(false);
    returnService.getReturn(id)
      .then(setReturnRecord)
      .catch(() => setLoadError(true));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching this return on mount/id-change is standard data-fetching, not derived state
    loadReturn();
  }, [loadReturn]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '50vh', gap: 'var(--space-4)' }}>
        <p className="text-secondary">{t('returns:detail.loadError')}</p>
        <button type="button" className="btn btn-secondary" onClick={loadReturn}>
          <FiRefreshCw aria-hidden="true" /> {t('common:actions.retry')}
        </button>
      </div>
    );
  }

  if (!returnRecord) {
    return <PageSkeleton />;
  }

  const handleApprove = async () => {
    setActionError('');
    try {
      await returnService.approveReturn(returnRecord.id);
      toast.success(t('returns:detail.toast.approved'));
      loadReturn();
    } catch (err) {
      setActionError(err.response?.data?.message || t('returns:detail.toast.approveFailed'));
    }
  };

  const handleReject = async () => {
    setActionError('');
    try {
      await returnService.rejectReturn(returnRecord.id);
      toast.success(t('returns:detail.toast.rejected'));
      loadReturn();
    } catch (err) {
      setActionError(err.response?.data?.message || t('returns:detail.toast.rejectFailed'));
    }
  };

  const isPending = returnRecord.status === 'pending';

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/returns')}>
            <FiArrowLeft aria-hidden="true" /> {t('returns:detail.backToReturns')}
          </button>
          <h1 className="page-title">{returnRecord.return_number}</h1>
          <p className="page-subtitle">
            {t('returns:detail.againstSale', { saleNumber: returnRecord.sale_number })} · {returnRecord.branch_name} · {formatDateTime(returnRecord.created_at)}
          </p>
        </div>
        {canApprove && isPending && (
          <div className="page-actions">
            <button type="button" className="btn btn-danger" onClick={() => setDialog('reject')}>
              <FiX aria-hidden="true" /> {t('returns:detail.reject')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDialog('approve')}>
              <FiCheck aria-hidden="true" /> {t('returns:detail.approve')}
            </button>
          </div>
        )}
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card mb-5">
        <div className="card-body">
          <div className="form-row">
            <div>
              <span className="text-xs text-secondary">{t('returns:detail.status')}</span>
              <div><span className={`badge ${STATUS_BADGE[returnRecord.status] || 'badge-neutral'}`}>{STATUS_LABELS[returnRecord.status] || returnRecord.status}</span></div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('returns:detail.reason')}</span>
              <div className="text-sm">{REASON_LABELS[returnRecord.reason] || returnRecord.reason}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('returns:detail.customer')}</span>
              <div className="text-sm">
                {returnRecord.customer_first_name ? `${returnRecord.customer_first_name} ${returnRecord.customer_last_name}` : t('returns:detail.walkIn')}
              </div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('returns:detail.requestedBy')}</span>
              <div className="text-sm">{returnRecord.created_by_first_name} {returnRecord.created_by_last_name}</div>
            </div>
            {returnRecord.approved_by_first_name && (
              <div>
                <span className="text-xs text-secondary">{returnRecord.status === 'rejected' ? t('returns:detail.rejectedBy') : t('returns:detail.approvedBy')}</span>
                <div className="text-sm">{returnRecord.approved_by_first_name} {returnRecord.approved_by_last_name}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('returns:detail.returnedItems')}</span></div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>{t('returns:columns.product')}</th><th>{t('returns:columns.quantity')}</th><th>{t('returns:columns.unitPrice')}</th></tr>
            </thead>
            <tbody>
              {returnRecord.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name}<div className="text-xs text-secondary">{item.product_code}</div></td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('returns:detail.refund')}</span></div>
        <div className="card-body">
          <div className="form-row">
            <div>
              <span className="text-xs text-secondary">{t('returns:detail.refundAmount')}</span>
              <div className="text-sm font-semibold">{formatCurrency(returnRecord.refund_amount)}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('returns:detail.refundMethod')}</span>
              <div className="text-sm">{REFUND_METHOD_LABELS[returnRecord.refund_method] || returnRecord.refund_method}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('returns:detail.refundStatus')}</span>
              <div><span className={`badge ${returnRecord.refund_status === 'refunded' ? 'badge-success' : 'badge-warning'}`}>{REFUND_STATUS_LABELS[returnRecord.refund_status] || returnRecord.refund_status}</span></div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        onConfirm={handleApprove}
        title={t('returns:detail.approveDialogTitle')}
        message={t('returns:detail.approveDialogMessage')}
        confirmLabel={t('returns:detail.approveConfirm')}
        variant="primary"
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        onConfirm={handleReject}
        title={t('returns:detail.rejectDialogTitle')}
        message={t('returns:detail.rejectDialogMessage')}
        confirmLabel={t('returns:detail.rejectConfirm')}
        variant="danger"
      />
    </div>
  );
}

export default ReturnDetail;
