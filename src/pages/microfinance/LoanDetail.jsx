import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiCheck, FiX, FiDollarSign, FiSlash, FiPlus, FiRefreshCw } from 'react-icons/fi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import PageSkeleton from '../../components/common/PageSkeleton';
import EmptyState from '../../components/common/EmptyState';
import KPICard from '../../components/dashboard/KPICard';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as loanService from '../../services/loanService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = {
  submitted: 'badge-neutral', under_review: 'badge-warning', approved: 'badge-info',
  rejected: 'badge-danger', disbursed: 'badge-success', active: 'badge-success',
  completed: 'badge-success', defaulted: 'badge-danger', written_off: 'badge-danger',
};

const SCHEDULE_STATUS_BADGE = { pending: 'badge-neutral', partial: 'badge-warning', paid: 'badge-success', overdue: 'badge-danger' };

function LoanDetail() {
  const { t, i18n } = useTranslation(['microfinance', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canApprove = usePermission('loans.approve');
  const canDisburse = usePermission('loans.disburse');
  const canManage = usePermission('loans.manage');
  const canRepay = usePermission('loan_repayments.create');

  const [loan, setLoan] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => (isoString ? new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' }) : '—');

  const repaymentForm = useForm({ defaultValues: { amount: '', paymentMethod: 'cash', paymentDate: new Date().toISOString().slice(0, 10), reference: '' } });

  const loadLoan = useCallback(() => {
    setLoadError(false);
    loanService.getLoan(id)
      .then(setLoan)
      .catch(() => setLoadError(true));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching this loan on mount/id-change is standard data-fetching, not derived state
    loadLoan();
  }, [loadLoan]);

  // Only meaningful once a schedule exists (disbursed onward) — a loan
  // still awaiting approval/disbursement has no committed totals yet.
  const totals = useMemo(() => {
    if (!loan || loan.schedule.length === 0) return null;
    const totalPayable = loan.schedule.reduce((sum, row) => sum + Number(row.total_due), 0);
    const totalPaid = loan.schedule.reduce((sum, row) => sum + Number(row.amount_paid), 0);
    return { totalPayable, totalPaid, outstanding: Number(loan.principal_outstanding) + Number(loan.interest_outstanding) };
  }, [loan]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '50vh', gap: 'var(--space-4)' }}>
        <p className="text-secondary">{t('microfinance:loans.detail.loadError')}</p>
        <button type="button" className="btn btn-secondary" onClick={loadLoan}>
          <FiRefreshCw aria-hidden="true" /> {t('common:actions.retry')}
        </button>
      </div>
    );
  }

  if (!loan) {
    return <PageSkeleton />;
  }

  const runAction = async (action, successKey, errorKey) => {
    setActionError('');
    try {
      await action();
      toast.success(t(successKey));
      loadLoan();
    } catch (err) {
      setActionError(err.response?.data?.message || t(errorKey));
    } finally {
      setDialog(null);
    }
  };

  const outstandingNow = Number(loan.principal_outstanding) + Number(loan.interest_outstanding);

  const submitRepayment = async (values) => {
    const amount = Number(values.amount);
    if (amount > outstandingNow) {
      setActionError(t('microfinance:loans.detail.repaymentExceedsBalance', { balance: formatCurrency(outstandingNow) }));
      return;
    }
    setActionError('');
    try {
      await loanService.recordRepayment({
        loanId: loan.id, amount, paymentMethod: values.paymentMethod,
        paymentDate: values.paymentDate, reference: values.reference || undefined,
      });
      toast.success(t('microfinance:loans.detail.recordSuccess'));
      setRepaymentModalOpen(false);
      repaymentForm.reset({ amount: '', paymentMethod: 'cash', paymentDate: new Date().toISOString().slice(0, 10), reference: '' });
      loadLoan();
    } catch (err) {
      setActionError(err.response?.data?.message || t('microfinance:loans.detail.recordError'));
    }
  };

  const canReview = canApprove && loan.status === 'submitted';
  const canApproveReject = canApprove && ['submitted', 'under_review'].includes(loan.status);
  const canDisburseNow = canDisburse && loan.status === 'approved';
  const canWriteOff = canManage && ['active', 'defaulted'].includes(loan.status);
  const canRecordRepayment = canRepay && loan.status === 'active';

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/loans')}>
            <FiArrowLeft aria-hidden="true" /> {t('microfinance:loans.detail.backToLoans')}
          </button>
          <h1 className="page-title">{loan.loan_number}</h1>
          <p className="page-subtitle">{loan.borrower_first_name} {loan.borrower_last_name} · {formatDate(loan.created_at)}</p>
        </div>
        <div className="page-actions">
          {canReview && (
            <button type="button" className="btn btn-secondary" onClick={() => runAction(() => loanService.markUnderReview(loan.id), 'microfinance:loans.detail.toastReviewed', 'microfinance:loans.detail.toastReviewed')}>
              {t('microfinance:loans.detail.review')}
            </button>
          )}
          {canApproveReject && (
            <>
              <button type="button" className="btn btn-danger" onClick={() => setDialog('reject')}>
                <FiX aria-hidden="true" /> {t('microfinance:loans.detail.reject')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setDialog('approve')}>
                <FiCheck aria-hidden="true" /> {t('microfinance:loans.detail.approve')}
              </button>
            </>
          )}
          {canDisburseNow && (
            <button type="button" className="btn btn-primary" onClick={() => setDialog('disburse')}>
              <FiDollarSign aria-hidden="true" /> {t('microfinance:loans.detail.disburse')}
            </button>
          )}
          {canRecordRepayment && (
            <button type="button" className="btn btn-primary" onClick={() => setRepaymentModalOpen(true)}>
              <FiPlus aria-hidden="true" /> {t('microfinance:loans.detail.recordRepayment')}
            </button>
          )}
          {canWriteOff && (
            <button type="button" className="btn btn-danger" onClick={() => setDialog('writeOff')}>
              <FiSlash aria-hidden="true" /> {t('microfinance:loans.detail.writeOff')}
            </button>
          )}
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card mb-5">
        <div className="card-body">
          <div className="form-row">
            <div>
              <span className="text-xs text-secondary">{t('microfinance:loans.detail.borrower')}</span>
              <div className="text-sm font-semibold">{loan.borrower_first_name} {loan.borrower_last_name}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('microfinance:loans.detail.requestedAmount')}</span>
              <div className="text-sm font-semibold">{formatCurrency(loan.approved_amount || loan.requested_amount)}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('microfinance:loans.detail.interestRate')}</span>
              <div className="text-sm">{loan.interest_rate}%</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('microfinance:loans.detail.duration')}</span>
              <div className="text-sm">{loan.duration_value} {t(`microfinance:loanProducts.form.${loan.duration_unit}`)}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('microfinance:loans.form.startDateLabel')}</span>
              <div className="text-sm">{formatDate(loan.requested_start_date)}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('microfinance:loans.detail.status')}</span>
              <div><span className={`badge ${STATUS_BADGE[loan.status] || 'badge-neutral'}`}>{t(`microfinance:loans.status.${loan.status}`)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {totals ? (
        <div className="grid grid-cols-3 mb-5">
          <KPICard icon={FiDollarSign} label={t('microfinance:loans.detail.totalPayable')} value={totals.totalPayable} formatter={(v) => formatCurrency(v)} />
          <KPICard icon={FiCheck} label={t('microfinance:loans.detail.totalPaid')} value={totals.totalPaid} formatter={(v) => formatCurrency(v)} />
          <KPICard icon={FiDollarSign} label={t('microfinance:loans.detail.outstandingBalance')} value={totals.outstanding} formatter={(v) => formatCurrency(v)} />
        </div>
      ) : (
        <div className="alert alert-info mb-5">{t('microfinance:loans.detail.noSchedule')}</div>
      )}

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('microfinance:loans.detail.scheduleTitle')}</span></div>
        {loan.schedule.length === 0 ? (
          <div className="card-body"><EmptyState title={t('microfinance:loans.detail.noSchedule')} /></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('microfinance:loans.detail.scheduleColumns.installment')}</th>
                  <th>{t('microfinance:loans.detail.scheduleColumns.dueDate')}</th>
                  <th>{t('microfinance:loans.detail.scheduleColumns.principal')}</th>
                  <th>{t('microfinance:loans.detail.scheduleColumns.interest')}</th>
                  <th>{t('microfinance:loans.detail.scheduleColumns.total')}</th>
                  <th>{t('microfinance:loans.detail.scheduleColumns.paid')}</th>
                  <th>{t('microfinance:loans.detail.scheduleColumns.balance')}</th>
                  <th>{t('microfinance:loans.detail.scheduleColumns.status')}</th>
                </tr>
              </thead>
              <tbody>
                {loan.schedule.map((row) => (
                  <tr key={row.id}>
                    <td>{row.installment_number}</td>
                    <td>{formatDate(row.due_date)}</td>
                    <td>{formatCurrency(row.principal_due)}</td>
                    <td>{formatCurrency(row.interest_due)}</td>
                    <td>{formatCurrency(row.total_due)}</td>
                    <td>{formatCurrency(row.amount_paid)}</td>
                    <td>{formatCurrency(Number(row.total_due) - Number(row.amount_paid))}</td>
                    <td><span className={`badge ${SCHEDULE_STATUS_BADGE[row.status] || 'badge-neutral'}`}>{t(`microfinance:loans.scheduleStatus.${row.status}`)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('microfinance:loans.detail.loanInformation')}</span></div>
        <div className="card-body">
          <div className="form-row">
            {loan.purpose && (
              <div>
                <span className="text-xs text-secondary">{t('microfinance:loans.detail.purpose')}</span>
                <div className="text-sm">{loan.purpose}</div>
              </div>
            )}
            <div>
              <span className="text-xs text-secondary">{t('microfinance:loans.detail.disbursementDate')}</span>
              <div className="text-sm">{formatDate(loan.disbursed_at)}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('microfinance:loans.detail.paymentFrequency')}</span>
              <div className="text-sm">{t(`microfinance:loanProducts.form.${loan.repayment_frequency}`)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('microfinance:loans.detail.repaymentsTitle')}</span></div>
        {loan.repayments.length === 0 ? (
          <div className="card-body"><EmptyState title={t('microfinance:loans.detail.noRepayments')} /></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>{t('common:labels.date')}</th><th>{t('microfinance:loans.detail.repaymentAmountLabel')}</th><th>{t('microfinance:loans.detail.paymentMethodLabel')}</th><th>{t('microfinance:loans.detail.referenceLabel')}</th></tr></thead>
              <tbody>
                {loan.repayments.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.payment_date)}</td>
                    <td>{formatCurrency(r.amount)}</td>
                    <td>{t(`microfinance:loans.paymentMethods.${r.payment_method}`)}</td>
                    <td>{r.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction(() => loanService.approveLoan(loan.id, {}), 'microfinance:loans.detail.toastApproved', 'microfinance:loans.detail.toastApproved')}
        title={t('microfinance:loans.detail.approveDialogTitle')}
        message={t('microfinance:loans.detail.approveDialogMessage')}
        confirmLabel={t('microfinance:loans.detail.approveConfirm')}
        variant="primary"
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction(() => loanService.rejectLoan(loan.id, {}), 'microfinance:loans.detail.toastRejected', 'microfinance:loans.detail.toastRejected')}
        title={t('microfinance:loans.detail.rejectDialogTitle')}
        message={t('microfinance:loans.detail.rejectDialogMessage')}
        confirmLabel={t('microfinance:loans.detail.rejectConfirm')}
        variant="danger"
      />
      <ConfirmDialog
        open={dialog === 'disburse'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction(() => loanService.disburseLoan(loan.id), 'microfinance:loans.detail.toastDisbursed', 'microfinance:loans.detail.toastDisbursed')}
        title={t('microfinance:loans.detail.disburseDialogTitle')}
        message={t('microfinance:loans.detail.disburseDialogMessage')}
        confirmLabel={t('microfinance:loans.detail.disburseConfirm')}
        variant="primary"
      />
      <ConfirmDialog
        open={dialog === 'writeOff'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction(() => loanService.writeOffLoan(loan.id), 'microfinance:loans.detail.toastWrittenOff', 'microfinance:loans.detail.toastWrittenOff')}
        title={t('microfinance:loans.detail.writeOffDialogTitle')}
        message={t('microfinance:loans.detail.writeOffDialogMessage')}
        confirmLabel={t('microfinance:loans.detail.writeOffConfirm')}
        variant="danger"
      />

      <Modal
        open={repaymentModalOpen}
        onClose={() => setRepaymentModalOpen(false)}
        title={t('microfinance:loans.detail.recordRepayment')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRepaymentModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="repayment-form" className="btn btn-primary">{t('microfinance:loans.detail.recordRepayment')}</button>
          </>
        }
      >
        <div className="form-group">
          <span className="text-xs text-secondary">{t('microfinance:loans.detail.outstandingBalance')}</span>
          <div className="text-sm font-semibold">{formatCurrency(outstandingNow)}</div>
        </div>
        <form id="repayment-form" onSubmit={repaymentForm.handleSubmit(submitRepayment)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="amount">{t('microfinance:loans.detail.repaymentAmountLabel')}</label>
            <input
              id="amount" type="number" min="0" max={outstandingNow} step="0.01"
              className="form-control"
              {...repaymentForm.register('amount', { required: true, max: { value: outstandingNow, message: t('microfinance:loans.detail.repaymentExceedsBalance', { balance: formatCurrency(outstandingNow) }) } })}
            />
            {repaymentForm.formState.errors.amount && <span className="form-error">{repaymentForm.formState.errors.amount.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="paymentDate">{t('microfinance:loans.detail.paymentDateLabel')}</label>
            <input id="paymentDate" type="date" className="form-control" {...repaymentForm.register('paymentDate', { required: true })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="paymentMethod">{t('microfinance:loans.detail.paymentMethodLabel')}</label>
            <select id="paymentMethod" className="form-control" {...repaymentForm.register('paymentMethod')}>
              <option value="cash">{t('microfinance:loans.paymentMethods.cash')}</option>
              <option value="mobile_money">{t('microfinance:loans.paymentMethods.mobile_money')}</option>
              <option value="bank_transfer">{t('microfinance:loans.paymentMethods.bank_transfer')}</option>
              <option value="cheque">{t('microfinance:loans.paymentMethods.cheque')}</option>
              <option value="other">{t('microfinance:loans.paymentMethods.other')}</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label" htmlFor="reference">{t('microfinance:loans.detail.notesLabel')}</label>
            <input id="reference" className="form-control" {...repaymentForm.register('reference')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default LoanDetail;
