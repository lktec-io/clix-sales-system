import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiPrinter, FiPlus, FiCheck, FiX, FiDollarSign, FiSend } from 'react-icons/fi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import PageSkeleton from '../../components/common/PageSkeleton';
import EmptyState from '../../components/common/EmptyState';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as repairService from '../../services/repairService';
import * as productService from '../../services/productService';
import * as userService from '../../services/userService';
import { formatCurrency } from '../../utils/formatCurrency';
import '../../styles/pages/RepairDetail.css';

const STATUS_BADGE = {
  received: 'badge-neutral', diagnosis: 'badge-info', waiting_approval: 'badge-warning',
  approved: 'badge-info', in_repair: 'badge-info', ready_for_collection: 'badge-warning',
  completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger', unrepairable: 'badge-danger',
};

const CONDITION_KEYS = ['screen', 'body', 'backCover', 'camera', 'chargingPort', 'buttons', 'battery'];
const CONDITION_FIELD_TO_JSON = { backCover: 'backCover', chargingPort: 'chargingPort' };

function RepairDetail() {
  const { t, i18n } = useTranslation(['electronics', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canManage = usePermission('repairs.manage');

  const [repair, setRepair] = useState(null);
  const [products, setProducts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => (isoString ? new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' }) : '—');
  const formatDateTime = (isoString) => (isoString ? new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  const diagnosisForm = useForm({ defaultValues: { diagnosis: '', repairNotes: '', laborCharge: '' } });
  const partForm = useForm({ defaultValues: { productId: '', quantity: 1 } });
  const paymentForm = useForm({ defaultValues: { amount: '', paymentMethod: 'cash' } });

  const loadRepair = useCallback(() => {
    repairService.getRepair(id).then((data) => {
      setRepair(data);
      diagnosisForm.reset({ diagnosis: data.diagnosis || '', repairNotes: data.repair_notes || '', laborCharge: data.labor_charge });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- diagnosisForm is stable across renders (from useForm), including it would just re-run this identically
  }, [id]);

  useEffect(() => {
    loadRepair();
    productService.listProducts({ limit: 200 }).then((result) => setProducts(result.items || []));
    userService.listUsers({ limit: 200 }).then((result) => setTechnicians(result.items || []));
  }, [loadRepair]);

  if (!repair) {
    return <PageSkeleton />;
  }

  const runAction = async (action) => {
    setActionError('');
    try {
      await action();
      toast.success(t('electronics:repairs.detail.actionSuccess'));
      loadRepair();
    } catch (err) {
      setActionError(err.response?.data?.message || t('electronics:repairs.detail.actionError'));
    } finally {
      setDialog(null);
    }
  };

  const saveDiagnosis = async (values) => {
    setActionError('');
    try {
      await repairService.updateDiagnosis(repair.id, {
        diagnosis: values.diagnosis, repairNotes: values.repairNotes,
        laborCharge: values.laborCharge === '' ? undefined : Number(values.laborCharge),
      });
      toast.success(t('electronics:repairs.detail.diagnosisSaveSuccess'));
      loadRepair();
    } catch (err) {
      setActionError(err.response?.data?.message || t('electronics:repairs.detail.diagnosisSaveError'));
    }
  };

  const addPart = async (values) => {
    setActionError('');
    try {
      await repairService.addPart(repair.id, { productId: Number(values.productId), quantity: Number(values.quantity) });
      toast.success(t('electronics:repairs.detail.partAddSuccess'));
      setPartModalOpen(false);
      partForm.reset({ productId: '', quantity: 1 });
      loadRepair();
    } catch (err) {
      setActionError(err.response?.data?.message || t('electronics:repairs.detail.partAddError'));
    }
  };

  const submitPayment = async (values) => {
    setActionError('');
    try {
      await repairService.recordPayment(repair.id, { amount: Number(values.amount), paymentMethod: values.paymentMethod });
      toast.success(t('electronics:repairs.detail.paymentSuccess'));
      setPaymentModalOpen(false);
      paymentForm.reset({ amount: '', paymentMethod: 'cash' });
      loadRepair();
    } catch (err) {
      setActionError(err.response?.data?.message || t('electronics:repairs.detail.paymentError'));
    }
  };

  const assignTechnician = async (technicianId) => {
    if (!technicianId) return;
    setActionError('');
    try {
      await repairService.assignTechnician(repair.id, Number(technicianId));
      toast.success(t('electronics:repairs.detail.technicianAssignSuccess'));
      loadRepair();
    } catch (err) {
      setActionError(err.response?.data?.message || t('electronics:repairs.detail.technicianAssignError'));
    }
  };

  const condition = repair.device_condition || {};
  const customerName = `${repair.customer_first_name} ${repair.customer_last_name}`;
  const technicianName = repair.technician_first_name ? `${repair.technician_first_name} ${repair.technician_last_name}` : t('electronics:repairs.unassignedTechnician');

  const canStartDiagnosis = canManage && repair.status === 'received';
  const canEditDiagnosis = canManage && ['received', 'diagnosis'].includes(repair.status);
  const canSendForApproval = canManage && repair.status === 'diagnosis';
  const canMarkUnrepairable = canManage && repair.status === 'diagnosis';
  const canApproveReject = canManage && repair.status === 'waiting_approval';
  const canStartRepair = canManage && repair.status === 'approved';
  const canAddPart = canManage && repair.status === 'in_repair';
  const canMarkReady = canManage && repair.status === 'in_repair';
  const canPay = canManage && !['cancelled', 'rejected', 'unrepairable'].includes(repair.status);
  const canComplete = canManage && repair.status === 'ready_for_collection';
  const canCancel = canManage && !['completed', 'cancelled', 'rejected', 'unrepairable'].includes(repair.status);

  return (
    <div className="repair-detail-page">
      <div className="repair-print-header">
        <span className="repair-print-title">{t('electronics:repairs.print.title')}</span>
        <span className="repair-print-number">{repair.repair_number}</span>
      </div>

      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2 no-print" onClick={() => navigate('/repairs')}>
            <FiArrowLeft aria-hidden="true" /> {t('electronics:repairs.detail.backToRepairs')}
          </button>
          <h1 className="page-title">{repair.repair_number}</h1>
          <p className="page-subtitle">{customerName} · {repair.brand} {repair.model} · {formatDateTime(repair.received_at)}</p>
        </div>
        <div className="page-actions no-print">
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <FiPrinter aria-hidden="true" /> {t('electronics:repairs.detail.print')}
          </button>
          {canStartDiagnosis && (
            <button type="button" className="btn btn-primary" onClick={() => runAction(() => repairService.startDiagnosis(repair.id))}>
              {t('electronics:repairs.detail.startDiagnosis')}
            </button>
          )}
          {canSendForApproval && (
            <button type="button" className="btn btn-primary" onClick={() => runAction(() => repairService.sendForApproval(repair.id))}>
              <FiSend aria-hidden="true" /> {t('electronics:repairs.detail.sendForApproval')}
            </button>
          )}
          {canMarkUnrepairable && (
            <button type="button" className="btn btn-danger" onClick={() => setDialog('unrepairable')}>
              {t('electronics:repairs.detail.markUnrepairable')}
            </button>
          )}
          {canApproveReject && (
            <>
              <button type="button" className="btn btn-danger" onClick={() => setDialog('reject')}>
                <FiX aria-hidden="true" /> {t('electronics:repairs.detail.reject')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => runAction(() => repairService.approve(repair.id))}>
                <FiCheck aria-hidden="true" /> {t('electronics:repairs.detail.approve')}
              </button>
            </>
          )}
          {canStartRepair && (
            <button type="button" className="btn btn-primary" onClick={() => runAction(() => repairService.startRepair(repair.id))}>
              {t('electronics:repairs.detail.startRepair')}
            </button>
          )}
          {canMarkReady && (
            <button type="button" className="btn btn-primary" onClick={() => runAction(() => repairService.markReady(repair.id))}>
              {t('electronics:repairs.detail.markReady')}
            </button>
          )}
          {canPay && (
            <button type="button" className="btn btn-primary" onClick={() => setPaymentModalOpen(true)}>
              <FiDollarSign aria-hidden="true" /> {t('electronics:repairs.detail.recordPayment')}
            </button>
          )}
          {canComplete && (
            <button type="button" className="btn btn-primary" onClick={() => runAction(() => repairService.completeCollection(repair.id))}>
              {t('electronics:repairs.detail.completeCollection')}
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-danger" onClick={() => setDialog('cancel')}>
              {t('electronics:repairs.detail.cancelRepair')}
            </button>
          )}
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4 no-print" role="alert">{actionError}</div>}

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('electronics:repairs.detail.customerDeviceSection')}</span></div>
        <div className="card-body">
          <div className="form-row">
            <div><span className="text-xs text-secondary">{t('electronics:repairs.columns.customer')}</span><div className="text-sm font-semibold">{customerName}</div></div>
            <div><span className="text-xs text-secondary">{t('electronics:repairs.form.deviceTypeLabel')}</span><div className="text-sm">{t(`electronics:repairs.deviceTypes.${repair.device_type}`)}</div></div>
            <div><span className="text-xs text-secondary">{t('electronics:repairs.print.device')}</span><div className="text-sm">{repair.brand} {repair.model} {repair.device_color ? `(${repair.device_color})` : ''}</div></div>
            <div><span className="text-xs text-secondary">{t('electronics:repairs.print.imeiSerial')}</span><div className="text-sm">{repair.imei_1 || repair.serial_number || '—'}</div></div>
            <div><span className="text-xs text-secondary">{t('electronics:repairs.columns.status')}</span><div><span className={`badge ${STATUS_BADGE[repair.status] || 'badge-neutral'}`}>{t(`electronics:repairs.status.${repair.status}`)}</span></div></div>
            <div className="no-print">
              <span className="text-xs text-secondary">{t('electronics:repairs.columns.technician')}</span>
              {canManage ? (
                <select className="form-control" value={repair.technician_id || ''} onChange={(e) => assignTechnician(e.target.value)}>
                  <option value="">{t('electronics:repairs.unassignedTechnician')}</option>
                  {technicians.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              ) : (
                <div className="text-sm">{technicianName}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('electronics:repairs.detail.conditionSection')}</span></div>
        <div className="card-body">
          <div className="repair-condition-grid">
            {CONDITION_KEYS.map((key) => {
              const jsonKey = CONDITION_FIELD_TO_JSON[key] || key;
              const value = condition[jsonKey];
              return (
                <div key={key}>
                  <span className="text-xs text-secondary">{t(`electronics:repairs.condition.${key}`)}</span>
                  <div className="text-sm">{value ? t(`electronics:repairs.condition.options.${value}`) : '—'}</div>
                </div>
              );
            })}
          </div>
          {condition.notes && <p className="text-sm text-secondary mt-3 mb-0">{condition.notes}</p>}
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('electronics:repairs.detail.problemSection')}</span></div>
        <div className="card-body"><p className="text-sm mb-0">{repair.reported_problem}</p></div>
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('electronics:repairs.detail.diagnosisSection')}</span></div>
        <div className="card-body">
          {canEditDiagnosis ? (
            <form onSubmit={diagnosisForm.handleSubmit(saveDiagnosis)} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="diagnosis">{t('electronics:repairs.detail.diagnosisLabel')}</label>
                <textarea id="diagnosis" className="form-control" rows={3} {...diagnosisForm.register('diagnosis')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="repairNotes">{t('electronics:repairs.detail.repairNotesLabel')}</label>
                <textarea id="repairNotes" className="form-control" rows={2} {...diagnosisForm.register('repairNotes')} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label" htmlFor="laborCharge">{t('electronics:repairs.detail.laborChargeLabel')}</label>
                <input id="laborCharge" type="number" min="0" step="0.01" className="form-control" {...diagnosisForm.register('laborCharge')} />
              </div>
              <div className="form-actions no-print">
                <button type="submit" className="btn btn-primary">{t('electronics:repairs.detail.saveDiagnosis')}</button>
              </div>
            </form>
          ) : (
            <div className="form-row">
              <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.diagnosisLabel')}</span><div className="text-sm">{repair.diagnosis || '—'}</div></div>
              <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.repairNotesLabel')}</span><div className="text-sm">{repair.repair_notes || '—'}</div></div>
              <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.laborChargeLabel')}</span><div className="text-sm">{formatCurrency(repair.labor_charge)}</div></div>
            </div>
          )}
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-header">
          <span className="card-title">{t('electronics:repairs.detail.partsSection')}</span>
          {canAddPart && (
            <button type="button" className="btn btn-secondary btn-sm no-print" onClick={() => setPartModalOpen(true)}>
              <FiPlus aria-hidden="true" /> {t('electronics:repairs.detail.addPart')}
            </button>
          )}
        </div>
        {repair.parts.length === 0 ? (
          <div className="card-body"><EmptyState title={t('electronics:repairs.list.emptyMessage')} /></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('electronics:repairs.partColumns.product')}</th>
                  <th>{t('electronics:repairs.partColumns.quantity')}</th>
                  <th>{t('electronics:repairs.partColumns.unitPrice')}</th>
                  <th>{t('electronics:repairs.partColumns.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {repair.parts.map((part) => (
                  <tr key={part.id}>
                    <td>{part.product_name}</td>
                    <td>{part.quantity}</td>
                    <td>{formatCurrency(part.unit_price)}</td>
                    <td>{formatCurrency(part.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('electronics:repairs.detail.financialSection')}</span></div>
        <div className="card-body repair-financial-grid">
          <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.partsTotal')}</span><div className="text-sm font-semibold">{formatCurrency(repair.parts_total)}</div></div>
          <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.laborCharge')}</span><div className="text-sm font-semibold">{formatCurrency(repair.labor_charge)}</div></div>
          <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.repairTotal')}</span><div className="text-sm font-semibold">{formatCurrency(repair.repair_total)}</div></div>
          <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.amountPaid')}</span><div className="text-sm font-semibold">{formatCurrency(repair.amount_paid)}</div></div>
          <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.balance')}</span><div className="text-lg font-semibold">{formatCurrency(repair.balance)}</div></div>
        </div>
        {repair.payments.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>{t('common:labels.date')}</th><th>{t('electronics:repairs.detail.paymentAmountLabel')}</th><th>{t('electronics:repairs.detail.paymentMethodLabel')}</th></tr></thead>
              <tbody>
                {repair.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.created_at)}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>{t(`electronics:repairs.paymentMethods.${p.payment_method}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card no-print">
        <div className="card-header"><span className="card-title">{t('electronics:repairs.detail.timelineSection')}</span></div>
        {repair.history.length === 0 ? (
          <div className="card-body text-sm text-secondary">{t('electronics:repairs.detail.noTimeline')}</div>
        ) : (
          <ul className="repair-timeline">
            {repair.history.map((h) => (
              <li key={h.id}>
                <span className={`badge ${STATUS_BADGE[h.to_status] || 'badge-neutral'}`}>{t(`electronics:repairs.status.${h.to_status}`)}</span>
                <span className="text-sm">{formatDateTime(h.created_at)}</span>
                <span className="text-xs text-secondary">{h.changed_by_first_name} {h.changed_by_last_name}</span>
                {h.notes && <span className="text-xs text-secondary">— {h.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="repair-print-footer">
        <div><span className="text-xs">{t('electronics:repairs.print.receivedDate')}</span>: {formatDate(repair.received_at)}</div>
        <div><span className="text-xs">{t('electronics:repairs.print.expectedDate')}</span>: {formatDate(repair.expected_completion_at)}</div>
        <div><span className="text-xs">{t('electronics:repairs.print.technician')}</span>: {technicianName}</div>
        <p className="repair-print-terms">{t('electronics:repairs.print.terms')}</p>
      </div>

      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction(() => repairService.cancelRepair(repair.id))}
        title={t('electronics:repairs.detail.cancelConfirmTitle')}
        message={t('electronics:repairs.detail.cancelConfirmMessage')}
        confirmLabel={t('electronics:repairs.detail.cancelRepair')}
        variant="danger"
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction(() => repairService.reject(repair.id))}
        title={t('electronics:repairs.detail.rejectConfirmTitle')}
        message={t('electronics:repairs.detail.rejectConfirmMessage')}
        confirmLabel={t('electronics:repairs.detail.reject')}
        variant="danger"
      />
      <ConfirmDialog
        open={dialog === 'unrepairable'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction(() => repairService.markUnrepairable(repair.id))}
        title={t('electronics:repairs.detail.unrepairableConfirmTitle')}
        message={t('electronics:repairs.detail.unrepairableConfirmMessage')}
        confirmLabel={t('electronics:repairs.detail.markUnrepairable')}
        variant="danger"
      />

      <Modal
        open={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        title={t('electronics:repairs.detail.addPart')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPartModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="part-form" className="btn btn-primary">{t('electronics:repairs.detail.addPart')}</button>
          </>
        }
      >
        <form id="part-form" onSubmit={partForm.handleSubmit(addPart)} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="productId">{t('electronics:repairs.detail.selectProduct')}</label>
            <select id="productId" className="form-control" {...partForm.register('productId', { required: true })}>
              <option value="">{t('electronics:repairs.detail.selectProduct')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label" htmlFor="quantity">{t('electronics:repairs.detail.quantityLabel')}</label>
            <input id="quantity" type="number" min="1" className="form-control" {...partForm.register('quantity', { required: true, min: 1 })} />
          </div>
        </form>
      </Modal>

      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={t('electronics:repairs.detail.recordPayment')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPaymentModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="payment-form" className="btn btn-primary">{t('electronics:repairs.detail.recordPayment')}</button>
          </>
        }
      >
        <div className="form-group">
          <span className="text-xs text-secondary">{t('electronics:repairs.detail.balance')}</span>
          <div className="text-sm font-semibold">{formatCurrency(repair.balance)}</div>
        </div>
        <form id="payment-form" onSubmit={paymentForm.handleSubmit(submitPayment)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="amount">{t('electronics:repairs.detail.paymentAmountLabel')}</label>
            <input id="amount" type="number" min="0" step="0.01" className="form-control" {...paymentForm.register('amount', { required: true, min: 0.01 })} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label" htmlFor="paymentMethod">{t('electronics:repairs.detail.paymentMethodLabel')}</label>
            <select id="paymentMethod" className="form-control" {...paymentForm.register('paymentMethod')}>
              <option value="cash">{t('electronics:repairs.paymentMethods.cash')}</option>
              <option value="mobile_money">{t('electronics:repairs.paymentMethods.mobile_money')}</option>
              <option value="bank_transfer">{t('electronics:repairs.paymentMethods.bank_transfer')}</option>
              <option value="card">{t('electronics:repairs.paymentMethods.card')}</option>
              <option value="other">{t('electronics:repairs.paymentMethods.other')}</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default RepairDetail;
