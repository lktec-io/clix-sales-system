import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiPrinter, FiPlus, FiCheck, FiX, FiDollarSign, FiChevronRight, FiMessageSquare, FiCheckCircle } from 'react-icons/fi';
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

// Mirrors the exact Swahili wording sms.service.js sends automatically on
// these transitions (repair_received/repair_diagnosis_update/
// repair_ready_for_collection) — a "quick template" only pre-fills the
// same message a technician can already send manually via the custom-
// message endpoint, it never invents new wording or a second send path.
// Every customer-facing repair SMS is Swahili regardless of the
// technician's own dashboard language — the customer receiving it, not the
// operator, is who this text is for.
const SMS_TEMPLATES = {
  received: (repair) => `Habari ${repair.customer_first_name}, kifaa chako kimepokelewa kwa ajili ya matengenezo. Namba ya kazi ni ${repair.repair_number}. Tutakujulisha hatua inayofuata. Asante.`,
  diagnosis: (repair) => `Habari ${repair.customer_first_name}, uchunguzi wa kifaa chako umekamilika. Tafadhali wasiliana nasi kwa taarifa zaidi kuhusu gharama na matengenezo. Kazi Na. ${repair.repair_number}.`,
  ready: (repair) => `Habari ${repair.customer_first_name}, kifaa chako kimetengenezwa na kiko tayari kuchukuliwa. Kazi Na. ${repair.repair_number}. Asante kwa kutuamini.`,
};

// The device's journey shown as a forward-looking stepper — distinct from
// the chronological .repair-timeline list below it, which stays a log.
// 'approved' and 'waiting_approval' share the Approval stage (both are
// "in approval"); 'diagnosis' status just skips ahead of the Diagnosis
// stage. Terminal statuses (cancelled/rejected/unrepairable) are
// deliberately NOT mapped here — they get their own "-ended" treatment
// rather than being forced onto the happy-path sequence.
const STAGE_KEYS = ['received', 'diagnosis', 'approval', 'repair', 'ready', 'collected'];
const STATUS_TO_STAGE_INDEX = {
  received: 0, diagnosis: 1, waiting_approval: 2, approved: 2, in_repair: 3, ready_for_collection: 4, completed: 5,
};
const TERMINAL_STATUSES = ['cancelled', 'rejected', 'unrepairable'];

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
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);

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
    try {
      await action();
      toast.success(t('electronics:repairs.detail.actionSuccess'));
      loadRepair();
    } catch (err) {
      toast.error(err.response?.data?.message || t('electronics:repairs.detail.actionError'));
    } finally {
      setDialog(null);
    }
  };

  const saveDiagnosis = async (values) => {
    try {
      await repairService.updateDiagnosis(repair.id, {
        diagnosis: values.diagnosis, repairNotes: values.repairNotes,
        laborCharge: values.laborCharge === '' ? undefined : Number(values.laborCharge),
      });
      toast.success(t('electronics:repairs.detail.diagnosisSaveSuccess'));
      loadRepair();
    } catch (err) {
      toast.error(err.response?.data?.message || t('electronics:repairs.detail.diagnosisSaveError'));
    }
  };

  const addPart = async (values) => {
    try {
      await repairService.addPart(repair.id, { productId: Number(values.productId), quantity: Number(values.quantity) });
      toast.success(t('electronics:repairs.detail.partAddSuccess'));
      setPartModalOpen(false);
      partForm.reset({ productId: '', quantity: 1 });
      loadRepair();
    } catch (err) {
      toast.error(err.response?.data?.message || t('electronics:repairs.detail.partAddError'));
    }
  };

  const submitPayment = async (values) => {
    try {
      await repairService.recordPayment(repair.id, { amount: Number(values.amount), paymentMethod: values.paymentMethod });
      toast.success(t('electronics:repairs.detail.paymentSuccess'));
      setPaymentModalOpen(false);
      paymentForm.reset({ amount: '', paymentMethod: 'cash' });
      loadRepair();
    } catch (err) {
      toast.error(err.response?.data?.message || t('electronics:repairs.detail.paymentError'));
    }
  };

  // Reports whatever actually happened, including the "not configured" and
  // "rate limited" states, rather than a generic success/fail — the
  // backend always logs a real outcome, even when no SMS provider is set
  // up, and the UI must be honest about that instead of implying it sent.
  const submitSms = async () => {
    if (!smsMessage.trim()) return;
    setSmsSending(true);
    try {
      const result = await repairService.sendSms(repair.id, smsMessage.trim());
      if (result.status === 'sent') toast.success(t('electronics:repairs.detail.smsSentToast'));
      else if (result.status === 'skipped_not_configured') toast.info(t('electronics:repairs.detail.smsNotConfiguredToast'));
      else if (result.status === 'skipped_rate_limited') toast.warning(t('electronics:repairs.detail.smsRateLimitedToast'));
      else if (result.status === 'skipped_invalid_phone') toast.error(t('electronics:repairs.detail.smsInvalidPhoneToast'));
      else toast.error(t('electronics:repairs.detail.smsFailedToast'));
      setSmsModalOpen(false);
      setSmsMessage('');
    } catch (err) {
      toast.error(err.response?.data?.message || t('electronics:repairs.detail.smsFailedToast'));
    } finally {
      setSmsSending(false);
    }
  };

  const openSmsTemplate = (templateKey) => {
    setSmsMessage(SMS_TEMPLATES[templateKey](repair));
    setSmsModalOpen(true);
  };

  const openCustomSms = () => {
    setSmsMessage('');
    setSmsModalOpen(true);
  };

  const assignTechnician = async (technicianId) => {
    if (!technicianId) return;
    try {
      await repairService.assignTechnician(repair.id, Number(technicianId));
      toast.success(t('electronics:repairs.detail.technicianAssignSuccess'));
      loadRepair();
    } catch (err) {
      toast.error(err.response?.data?.message || t('electronics:repairs.detail.technicianAssignError'));
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

  // The single "what should I do next" answer the hero surfaces — reuses
  // the exact same handlers the page already defines for these transitions,
  // just promoted to one obvious, prominent spot instead of being buried
  // among every other action in the page header.
  let primaryAction = null;
  let secondaryAction = null;
  if (canManage) {
    if (canStartDiagnosis) {
      primaryAction = { label: t('electronics:repairs.detail.startDiagnosis'), onClick: () => runAction(() => repairService.startDiagnosis(repair.id)) };
    } else if (canSendForApproval) {
      primaryAction = { label: t('electronics:repairs.detail.sendForApproval'), onClick: () => runAction(() => repairService.sendForApproval(repair.id)) };
      if (canMarkUnrepairable) secondaryAction = { label: t('electronics:repairs.detail.markUnrepairable'), onClick: () => setDialog('unrepairable') };
    } else if (canApproveReject) {
      primaryAction = { label: t('electronics:repairs.detail.approve'), onClick: () => runAction(() => repairService.approve(repair.id)) };
      secondaryAction = { label: t('electronics:repairs.detail.reject'), onClick: () => setDialog('reject') };
    } else if (canStartRepair) {
      primaryAction = { label: t('electronics:repairs.detail.startRepair'), onClick: () => runAction(() => repairService.startRepair(repair.id)) };
    } else if (canMarkReady) {
      primaryAction = { label: t('electronics:repairs.detail.markReady'), onClick: () => runAction(() => repairService.markReady(repair.id)) };
    } else if (canComplete) {
      primaryAction = { label: t('electronics:repairs.detail.completeCollection'), onClick: () => runAction(() => repairService.completeCollection(repair.id)) };
    }
  }

  const isEnded = TERMINAL_STATUSES.includes(repair.status);
  const reachedStageIndex = repair.history.reduce((max, h) => {
    const idx = STATUS_TO_STAGE_INDEX[h.to_status];
    return idx !== undefined ? Math.max(max, idx) : max;
  }, 0);
  const currentStageIndex = isEnded ? reachedStageIndex : (STATUS_TO_STAGE_INDEX[repair.status] ?? 0);

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
          {canPay && (
            <button type="button" className="btn btn-secondary" onClick={() => setPaymentModalOpen(true)}>
              <FiDollarSign aria-hidden="true" /> {t('electronics:repairs.detail.recordPayment')}
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-danger" onClick={() => setDialog('cancel')}>
              {t('electronics:repairs.detail.cancelRepair')}
            </button>
          )}
        </div>
      </div>

      {/* HERO — WHO/WHAT/PROBLEM/STATUS/MONEY/NEXT answered in one glance,
          before anything else on the page. Re-plays its entrance whenever
          repair.status actually changes (keyed below) — a quiet "you moved
          to a new stage" cue, not a replay on every incidental data refresh. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={repair.status}
          className="card repair-hero mb-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="repair-hero-top">
            <div>
              <h2 className="repair-hero-device">{repair.brand} {repair.model}</h2>
              <p className="repair-hero-number">{repair.repair_number}</p>
            </div>
            <span className={`badge ${STATUS_BADGE[repair.status] || 'badge-neutral'} repair-hero-status-badge`}>{t(`electronics:repairs.status.${repair.status}`)}</span>
          </div>
          <div className="repair-hero-customer">
            <span className="repair-hero-customer-name">{customerName}</span>
            <span className="repair-hero-customer-phone">{repair.customer_phone || '—'}</span>
          </div>
          <div className="repair-hero-financials">
            <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.repairTotal')}</span><div className="text-sm font-semibold">{formatCurrency(repair.repair_total)}</div></div>
            <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.amountPaid')}</span><div className="text-sm font-semibold">{formatCurrency(repair.amount_paid)}</div></div>
            <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.balance')}</span><div className="text-lg font-semibold">{formatCurrency(repair.balance)}</div></div>
          </div>
          {!isEnded && (primaryAction || secondaryAction) ? (
            <div className="repair-hero-actions no-print">
              {primaryAction && <button type="button" className="btn btn-primary btn-lg" onClick={primaryAction.onClick}>{primaryAction.label}</button>}
              {secondaryAction && <button type="button" className="btn btn-danger btn-lg" onClick={secondaryAction.onClick}>{secondaryAction.label}</button>}
            </div>
          ) : isEnded ? (
            <div className="repair-hero-ended no-print">
              {repair.status === 'completed' && (
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                  className="repair-hero-success-icon"
                >
                  <FiCheckCircle aria-hidden="true" />
                </motion.span>
              )}
              <span className={`badge ${STATUS_BADGE[repair.status] || 'badge-neutral'}`}>{t('electronics:repairs.detail.endedLabel')}</span>
              <span className="text-sm text-secondary">{t(`electronics:repairs.status.${repair.status}`)}</span>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="repair-stepper no-print" role="list" aria-label={t('electronics:repairs.detail.journeyLabel')}>
        {STAGE_KEYS.map((stageKey, index) => {
          const state = index < currentStageIndex || (index === currentStageIndex && isEnded)
            ? 'done'
            : index === currentStageIndex ? 'current' : 'upcoming';
          return (
            <span key={stageKey} className="flex items-center" style={{ gap: 'var(--space-1)' }}>
              <span role="listitem" className={`repair-stepper-step ${state === 'done' ? 'repair-stepper-step-done' : state === 'current' ? 'repair-stepper-step-current' : ''}`}>
                {state === 'done' && <FiCheck className="repair-stepper-step-icon" aria-hidden="true" />}
                {t(`electronics:repairs.stepper.${stageKey}`)}
              </span>
              {index < STAGE_KEYS.length - 1 && <FiChevronRight className="repair-stepper-connector" aria-hidden="true" />}
            </span>
          );
        })}
        {isEnded && (
          <>
            <FiChevronRight className="repair-stepper-connector" aria-hidden="true" />
            <span role="listitem" className="repair-stepper-step repair-stepper-step-ended">
              <FiX className="repair-stepper-step-icon" aria-hidden="true" />
              {t(`electronics:repairs.status.${repair.status}`)}
            </span>
          </>
        )}
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

      {canManage && (
        <div className="card mb-5 no-print">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.detail.communicationSection')}</span></div>
          <div className="card-body">
            <p className="text-sm text-secondary mb-3">{t('electronics:repairs.detail.smsToLabel')} {repair.customer_phone || '—'}</p>
            <div className="flex flex-wrap" style={{ gap: 'var(--space-2)' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openSmsTemplate('received')}>
                {t('electronics:repairs.detail.smsTemplateReceived')}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openSmsTemplate('diagnosis')}>
                {t('electronics:repairs.detail.smsTemplateDiagnosis')}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openSmsTemplate('ready')}>
                {t('electronics:repairs.detail.smsTemplateReady')}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={openCustomSms}>
                <FiMessageSquare aria-hidden="true" /> {t('electronics:repairs.detail.sendSms')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('electronics:repairs.detail.additionalDetailsSection')}</span></div>
        <div className="card-body">
          <div className="form-row mb-4">
            <div><span className="text-xs text-secondary">{t('electronics:repairs.form.deviceTypeLabel')}</span><div className="text-sm">{t(`electronics:repairs.deviceTypes.${repair.device_type}`)}</div></div>
            <div><span className="text-xs text-secondary">{t('electronics:repairs.print.imeiSerial')}</span><div className="text-sm">{repair.imei_1 || repair.serial_number || '—'}</div></div>
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

          <span className="text-xs text-secondary">{t('electronics:repairs.detail.problemSection')}</span>
          <p className="text-sm mt-1 mb-4">{repair.reported_problem}</p>

          <span className="text-xs text-secondary">{t('electronics:repairs.detail.conditionSection')}</span>
          {Array.isArray(condition.conditions) ? (
            <div className="repair-chip-group mt-2">
              {condition.conditions.length === 0
                ? <span className="text-sm text-secondary">—</span>
                : condition.conditions.map((key) => (
                  <span key={key} className="repair-chip repair-chip-active repair-chip-readonly">{t(`electronics:repairs.condition.options.${key}`)}</span>
                ))}
            </div>
          ) : (
            // Legacy shape (repairs created before the chip-based intake
            // redesign) — a per-component object, still fully readable.
            <div className="repair-condition-grid mt-2">
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
          )}
          {condition.notes && <p className="text-sm text-secondary mt-3 mb-0">{condition.notes}</p>}

          {Array.isArray(repair.accessories_received) && repair.accessories_received.length > 0 && (
            <>
              <div className="text-xs text-secondary mt-4">{t('electronics:repairs.form.accessoriesSection')}</div>
              <div className="repair-chip-group mt-2">
                {repair.accessories_received.map((key) => (
                  <span key={key} className="repair-chip repair-chip-active repair-chip-readonly">{t(`electronics:repairs.form.accessories.${key}`)}</span>
                ))}
              </div>
            </>
          )}
        </div>
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

      <Modal
        open={smsModalOpen}
        onClose={() => { setSmsModalOpen(false); setSmsMessage(''); }}
        title={t('electronics:repairs.detail.sendSms')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setSmsModalOpen(false); setSmsMessage(''); }}>{t('common:actions.cancel')}</button>
            <button
              type="button" className={`btn btn-primary ${smsSending ? 'btn-loading' : ''}`}
              disabled={smsSending || !smsMessage.trim()} onClick={submitSms}
            >
              {t('electronics:repairs.detail.sendSms')}
            </button>
          </>
        }
      >
        <div className="form-row mb-3">
          <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.smsCustomerLabel')}</span><div className="text-sm font-semibold">{customerName}</div></div>
          <div><span className="text-xs text-secondary">{t('electronics:repairs.detail.smsToLabel')}</span><div className="text-sm font-semibold">{repair.customer_phone || '—'}</div></div>
        </div>
        {smsSending && <p className="text-sm text-secondary mb-3">{t('electronics:repairs.detail.smsSendingLabel')}</p>}
        <div className="form-group mb-0">
          <label className="form-label form-label-required" htmlFor="smsMessage">{t('electronics:repairs.detail.smsMessageLabel')}</label>
          <textarea
            id="smsMessage" className="form-control" rows={4} maxLength={480}
            value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}

export default RepairDetail;
