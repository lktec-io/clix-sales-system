import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import PageSkeleton from '../../components/common/PageSkeleton';
import Modal from '../../components/common/Modal';
import { useTable } from '../../hooks/useTable';
import { useToast } from '../../hooks/useToast';
import * as billingService from '../../services/billingService';
import * as paymentService from '../../services/paymentService';
import { formatCurrency } from '../../utils/formatCurrency';
import '../../styles/pages/BillingOverview.css';

function daysRemainingLabel(t, count) {
  return count === null ? '—' : t('overview.daysRemaining') + ': ' + count;
}

const CYCLES = ['monthly', 'quarterly', 'yearly'];
const CYCLE_PRICE_FIELD = { monthly: 'priceMonthly', quarterly: 'priceQuarterly', yearly: 'priceYearly' };

function BillingOverview() {
  const { t } = useTranslation('billing');
  const toast = useToast();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [checkoutCycle, setCheckoutCycle] = useState('monthly');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [pendingInstructions, setPendingInstructions] = useState(null);

  const fetchInvoices = useCallback((params) => billingService.listMyInvoices(params), []);
  const invoicesTable = useTable(fetchInvoices);

  const fetchHistory = useCallback((params) => billingService.listMyHistory(params), []);
  const historyTable = useTable(fetchHistory);

  const fetchPayments = useCallback((params) => paymentService.listMyPayments(params), []);
  const paymentsTable = useTable(fetchPayments);

  const loadBillingSummary = useCallback(() => {
    return Promise.all([billingService.getMySubscription(), billingService.getPlans()])
      .then(([subscriptionData, planData]) => {
        setSubscription(subscriptionData);
        setPlans(planData);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadBillingSummary()
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load billing information.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadBillingSummary]);

  const openCheckout = (plan) => {
    setCheckoutError('');
    setCheckoutCycle('monthly');
    setCheckoutPlan(plan);
  };

  const submitCheckout = async () => {
    setCheckoutError('');
    setCheckoutSubmitting(true);
    try {
      const result = await paymentService.checkout({ planId: checkoutPlan.id, billingCycle: checkoutCycle });
      setCheckoutPlan(null);
      setPendingInstructions(result.checkout?.instructions || null);
      toast.success(t('overview.upgradeRequested'));
      await loadBillingSummary();
      paymentsTable.refetch();
    } catch (err) {
      setCheckoutError(err.response?.data?.message || 'Failed to request upgrade.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const isPendingPayment = subscription.status === 'pending_payment';

  const invoiceColumns = [
    { key: 'invoice_number', label: t('overview.columns.invoiceNumber') },
    { key: 'plan_name_snapshot', label: t('overview.columns.plan') },
    { key: 'period', label: t('overview.columns.period'), render: (row) => `${new Date(row.period_start).toLocaleDateString()} - ${new Date(row.period_end).toLocaleDateString()}` },
    { key: 'total', label: t('overview.columns.total'), render: (row) => formatCurrency(row.total, row.currency) },
    { key: 'payment_status', label: t('overview.columns.status'), render: (row) => (
      <span className={`badge ${row.payment_status === 'paid' ? 'badge-success' : 'badge-neutral'}`}>{t(`paymentStatus.${row.payment_status}`)}</span>
    ) },
    { key: 'actions', label: '', render: (row) => (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/billing/invoices/${row.id}`)}>{t('overview.viewInvoice')}</button>
    ) },
  ];

  const historyColumns = [
    { key: 'event_type', label: t('overview.columns.event') },
    { key: 'from_plan_name', label: 'From', render: (row) => row.from_plan_name || '—' },
    { key: 'to_plan_name', label: 'To', render: (row) => row.to_plan_name || '—' },
    { key: 'created_at', label: t('overview.columns.date'), render: (row) => new Date(row.created_at).toLocaleString() },
  ];

  const paymentColumns = [
    { key: 'internal_reference', label: t('overview.columns.reference') },
    { key: 'amount', label: t('overview.columns.total'), render: (row) => formatCurrency(row.amount, row.currency) },
    { key: 'status', label: t('overview.columns.status'), render: (row) => (
      <span className={`badge ${row.status === 'succeeded' ? 'badge-success' : row.status === 'failed' ? 'badge-danger' : 'badge-neutral'}`}>
        {t(`paymentState.${row.status}`)}
      </span>
    ) },
    { key: 'created_at', label: t('overview.columns.date'), render: (row) => new Date(row.created_at).toLocaleString() },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('overview.title')}</h1>
          <p className="page-subtitle">{t('overview.subtitle')}</p>
        </div>
      </div>

      {isPendingPayment && (
        <div className="alert alert-warning mb-4" role="status">
          {t('overview.pendingPaymentBanner')}
        </div>
      )}

      {pendingInstructions && (
        <div className="alert alert-info mb-4" role="status">
          {t('overview.instructionsIntro', { reference: pendingInstructions.reference, amount: formatCurrency(pendingInstructions.amount, pendingInstructions.currency) })}
        </div>
      )}

      <div className="card mb-5">
        <div className="card-body billing-summary">
          <dl className="billing-summary-list">
            <div><dt>{t('overview.currentPlan')}</dt><dd>{subscription.planName}</dd></div>
            <div><dt>{t('overview.subscriptionStatus')}</dt><dd>{t(`status.${subscription.status}`)}</dd></div>
            <div><dt>{t('overview.billingCycle')}</dt><dd>{subscription.billingCycle}</dd></div>
            <div><dt>{t('overview.renewalDate')}</dt><dd>{subscription.renewalDate ? new Date(subscription.renewalDate).toLocaleDateString() : '—'}</dd></div>
          </dl>
          <div className="billing-summary-days">{daysRemainingLabel(t, subscription.daysRemaining)}</div>
        </div>
      </div>

      <h2 className="section-title">{t('overview.availablePlans')}</h2>
      <div className="billing-plans-grid mb-5">
        {plans.map((plan) => {
          const isCurrentPlan = subscription.planId === plan.id && !isPendingPayment;
          return (
            <div key={plan.id} className={`billing-plan-card ${plan.isRecommended ? 'is-recommended' : ''}`}>
              {plan.isRecommended && <span className="billing-plan-badge">{t('overview.recommended')}</span>}
              <h3 className="billing-plan-name">{plan.name}</h3>
              <p className="billing-plan-description">{plan.description}</p>
              <div className="billing-plan-price">
                {formatCurrency(plan.priceMonthly, plan.currency)}<span>{t('overview.perMonth')}</span>
              </div>
              <ul className="billing-plan-cycles">
                <li><FiCheck aria-hidden="true" /> {formatCurrency(plan.priceQuarterly, plan.currency)}{t('overview.perQuarter')}</li>
                <li><FiCheck aria-hidden="true" /> {formatCurrency(plan.priceYearly, plan.currency)}{t('overview.perYear')}</li>
              </ul>
              <button
                type="button"
                className="btn btn-secondary billing-plan-choose"
                disabled={isCurrentPlan || isPendingPayment}
                title={isPendingPayment ? t('overview.pendingPaymentBanner') : undefined}
                onClick={() => openCheckout(plan)}
              >
                {isCurrentPlan ? t('overview.currentPlanBadge') : t('overview.choosePlan')}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('overview.myPayments')}</span></div>
        <Table columns={paymentColumns} rows={paymentsTable.items} loading={paymentsTable.loading} emptyMessage={t('overview.noPayments')} />
        <Pagination page={paymentsTable.page} totalPages={paymentsTable.meta.totalPages} total={paymentsTable.meta.total} limit={paymentsTable.meta.limit} onPageChange={paymentsTable.setPage} />
      </div>

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('overview.invoices')}</span></div>
        <Table columns={invoiceColumns} rows={invoicesTable.items} loading={invoicesTable.loading} emptyMessage={t('overview.noInvoices')} />
        <Pagination page={invoicesTable.page} totalPages={invoicesTable.meta.totalPages} total={invoicesTable.meta.total} limit={invoicesTable.meta.limit} onPageChange={invoicesTable.setPage} />
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('overview.billingHistory')}</span></div>
        <Table columns={historyColumns} rows={historyTable.items} loading={historyTable.loading} emptyMessage={t('overview.noHistory')} />
        <Pagination page={historyTable.page} totalPages={historyTable.meta.totalPages} total={historyTable.meta.total} limit={historyTable.meta.limit} onPageChange={historyTable.setPage} />
      </div>

      <Modal
        open={Boolean(checkoutPlan)}
        onClose={() => setCheckoutPlan(null)}
        title={checkoutPlan ? t('overview.checkoutTitle', { plan: checkoutPlan.name }) : ''}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCheckoutPlan(null)}>{t('overview.cancel')}</button>
            <button
              type="button" className={`btn btn-primary ${checkoutSubmitting ? 'btn-loading' : ''}`}
              disabled={checkoutSubmitting} onClick={submitCheckout}
            >
              {t('overview.confirmUpgrade')}
            </button>
          </>
        }
      >
        {checkoutPlan && (
          <>
            {checkoutError && <div className="alert alert-danger mb-4" role="alert">{checkoutError}</div>}
            <p className="text-sm text-secondary mb-3">{t('overview.checkoutIntro')}</p>
            <div className="form-group">
              <label className="form-label" htmlFor="checkoutCycle">{t('overview.billingCycle')}</label>
              <select id="checkoutCycle" className="form-control" value={checkoutCycle} onChange={(event) => setCheckoutCycle(event.target.value)}>
                {CYCLES.map((cycle) => (
                  <option key={cycle} value={cycle}>{t(`overview.cycleOptions.${cycle}`)}</option>
                ))}
              </select>
            </div>
            <div className="billing-plan-price mt-3">
              {formatCurrency(checkoutPlan[CYCLE_PRICE_FIELD[checkoutCycle]], checkoutPlan.currency)}
              <span>{t(`overview.cyclePriceSuffix.${checkoutCycle}`)}</span>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default BillingOverview;
