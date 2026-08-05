import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiArrowLeft, FiUsers, FiGrid, FiClock, FiSlash, FiCheckCircle } from 'react-icons/fi';
import KPICard from '../../../components/dashboard/KPICard';
import Table from '../../../components/common/Table';
import Pagination from '../../../components/common/Pagination';
import Modal from '../../../components/common/Modal';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import PageSkeleton from '../../../components/common/PageSkeleton';
import { useTable } from '../../../hooks/useTable';
import * as platformTenantService from '../../../services/platformTenantService';
import * as platformSubscriptionService from '../../../services/platformSubscriptionService';
import * as platformPlanService from '../../../services/platformPlanService';
import { formatCurrency } from '../../../utils/formatCurrency';
import { PLATFORM_ROUTES } from '../../../constants/routes';
import '../../../styles/pages/PlatformTenantDetail.css';

const TRIAL_ACTION_LABELS = {
  extend: 'Extend Trial',
  reduce: 'Reduce Trial',
  reset: 'Reset Trial',
};

const BILLING_ACTION_LABELS = {
  upgrade: 'Upgrade Plan',
  downgrade: 'Downgrade Plan',
};

function daysRemainingUntil(trialEndsAt) {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
}

function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [trialModal, setTrialModal] = useState(null); // 'extend' | 'reduce' | 'reset' | null
  const [pendingConfirm, setPendingConfirm] = useState(null); // 'suspend' | 'activate' | 'activate-subscription' | 'expire' | null

  // Phase 4 — Subscription & Billing card. Loaded via its own effect/state,
  // separate from `detail` above (a different endpoint, a different table)
  // rather than folded into the existing load() — keeps Phase 3's own
  // tenant-detail fetch completely unchanged.
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [billingActionModal, setBillingActionModal] = useState(null); // 'upgrade' | 'downgrade' | null
  const [billingPendingConfirm, setBillingPendingConfirm] = useState(null); // 'renew' | 'cancel' | 'resume' | null
  const [billingError, setBillingError] = useState('');

  const fetchUsers = useCallback((params) => platformTenantService.listTenantUsers(id, params), [id]);
  const usersTable = useTable(fetchUsers);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { days: 14, reason: '' } });

  const {
    register: registerBilling,
    handleSubmit: handleSubmitBilling,
    reset: resetBilling,
    formState: { errors: billingErrors, isSubmitting: billingSubmitting },
  } = useForm({ defaultValues: { planId: '', billingCycle: 'monthly' } });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await platformTenantService.getTenant(id);
      setDetail(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tenant.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadBilling = useCallback(async () => {
    setSubscriptionLoading(true);
    try {
      const [subscriptionResult, plansResult] = await Promise.all([
        platformSubscriptionService.getSubscription(id),
        platformPlanService.listPlans(),
      ]);
      setSubscription(subscriptionResult);
      setPlans(plansResult.filter((plan) => plan.is_active));
    } catch {
      // Subscription is an additive card — a failure here never blocks the
      // rest of the (Phase 3) tenant detail page from rendering.
    } finally {
      setSubscriptionLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    loadBilling();
  }, [load, loadBilling]);

  if (loading || !detail) return error ? <div className="alert alert-danger">{error}</div> : <PageSkeleton />;

  const { tenant, company, owner, userCount, branchCount, branches, recentLogins } = detail;
  const daysRemaining = daysRemainingUntil(tenant.trial_ends_at);

  const runConfirmedAction = async () => {
    try {
      if (pendingConfirm === 'suspend') await platformTenantService.suspendTenant(id);
      else if (pendingConfirm === 'activate') await platformTenantService.activateTenant(id);
      else if (pendingConfirm === 'activate-subscription') await platformTenantService.activateSubscription(id);
      else if (pendingConfirm === 'expire') await platformTenantService.expireImmediately(id);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    }
  };

  const onSubmitTrialModal = async (values) => {
    setActionError('');
    try {
      const days = Number(values.days);
      if (trialModal === 'extend') await platformTenantService.extendTrial(id, days);
      else if (trialModal === 'reduce') await platformTenantService.reduceTrial(id, days);
      else if (trialModal === 'reset') await platformTenantService.resetTrial(id, days);
      setTrialModal(null);
      reset({ days: 14 });
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    }
  };

  const runBillingConfirmedAction = async () => {
    setBillingError('');
    try {
      if (billingPendingConfirm === 'renew') await platformSubscriptionService.renewSubscription(id);
      else if (billingPendingConfirm === 'cancel') await platformSubscriptionService.cancelSubscription(id);
      else if (billingPendingConfirm === 'resume') await platformSubscriptionService.resumeSubscription(id);
      await loadBilling();
    } catch (err) {
      setBillingError(err.response?.data?.message || 'Action failed.');
    }
  };

  const onSubmitBillingModal = async (values) => {
    setBillingError('');
    try {
      const planId = Number(values.planId);
      if (billingActionModal === 'upgrade') await platformSubscriptionService.upgradePlan(id, planId, values.billingCycle);
      else if (billingActionModal === 'downgrade') await platformSubscriptionService.downgradePlan(id, planId, values.billingCycle);
      setBillingActionModal(null);
      resetBilling({ planId: '', billingCycle: 'monthly' });
      await loadBilling();
    } catch (err) {
      setBillingError(err.response?.data?.message || 'Action failed.');
    }
  };

  const userColumns = [
    { key: 'name', label: 'Name', render: (row) => `${row.first_name} ${row.last_name}` },
    { key: 'email', label: 'Email' },
    { key: 'role_name', label: 'Role' },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{row.status}</span>
    ) },
    { key: 'last_login_at', label: 'Last Login', render: (row) => (row.last_login_at ? new Date(row.last_login_at).toLocaleString() : 'Never') },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(PLATFORM_ROUTES.TENANTS)} aria-label="Back to tenants">
            <FiArrowLeft />
          </button>
          <div>
            <h1 className="page-title">{tenant.company_name}</h1>
            <p className="page-subtitle">{tenant.company_code} · Registered {new Date(tenant.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="page-actions flex gap-2">
          {tenant.status === 'active' ? (
            <button type="button" className="btn btn-danger" onClick={() => setPendingConfirm('suspend')}><FiSlash aria-hidden="true" /> Suspend</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setPendingConfirm('activate')}><FiCheckCircle aria-hidden="true" /> Activate</button>
          )}
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="kpi-grid">
        <KPICard icon={FiUsers} label="Users" value={userCount} accent="#2F6BFF" />
        <KPICard icon={FiGrid} label="Branches" value={branchCount} accent="#10B981" />
        <KPICard
          icon={FiClock}
          label={tenant.subscription_status === 'trial' ? 'Trial Days Remaining' : 'Plan Status'}
          value={tenant.subscription_status === 'trial' ? (daysRemaining ?? 0) : 0}
          formatter={tenant.subscription_status === 'trial' ? undefined : () => tenant.subscription_status}
          accent="#F59E0B"
        />
      </div>

      <div className="platform-detail-grid mt-5">
        <div className="card">
          <div className="card-header"><span className="card-title">Company Information</span></div>
          <div className="card-body">
            <dl className="platform-detail-list">
              <div><dt>Business Type</dt><dd>{company?.business_type || '—'}</dd></div>
              <div><dt>Email</dt><dd>{company?.email || '—'}</dd></div>
              <div><dt>Phone</dt><dd>{company?.phone || '—'}</dd></div>
              <div><dt>Country</dt><dd>{company?.country || '—'}</dd></div>
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Owner Information</span></div>
          <div className="card-body">
            {owner ? (
              <dl className="platform-detail-list">
                <div><dt>Name</dt><dd>{owner.first_name} {owner.last_name}</dd></div>
                <div><dt>Email</dt><dd>{owner.email}</dd></div>
                <div><dt>Phone</dt><dd>{owner.phone || '—'}</dd></div>
                <div><dt>Last Login</dt><dd>{owner.last_login_at ? new Date(owner.last_login_at).toLocaleString() : 'Never'}</dd></div>
              </dl>
            ) : <p className="text-sm text-secondary">No owner found.</p>}
          </div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="card-header"><span className="card-title">Subscription &amp; Trial</span></div>
        <div className="card-body">
          <dl className="platform-detail-list mb-4">
            <div><dt>Status</dt><dd>{tenant.status}</dd></div>
            <div><dt>Subscription</dt><dd>{tenant.subscription_status}</dd></div>
            <div><dt>Trial Started</dt><dd>{tenant.trial_started_at ? new Date(tenant.trial_started_at).toLocaleDateString() : '—'}</dd></div>
            <div><dt>Trial Ends</dt><dd>{tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString() : '—'}</dd></div>
          </dl>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { reset({ days: 14 }); setTrialModal('extend'); }}>Extend Trial</button>
            <button type="button" className="btn btn-secondary" onClick={() => { reset({ days: 7 }); setTrialModal('reduce'); }}>Reduce Trial</button>
            <button type="button" className="btn btn-secondary" onClick={() => { reset({ days: 14 }); setTrialModal('reset'); }}>Reset Trial</button>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingConfirm('activate-subscription')}>Activate Subscription</button>
            <button type="button" className="btn btn-danger" onClick={() => setPendingConfirm('expire')}>Expire Immediately</button>
          </div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="card-header"><span className="card-title">Subscription &amp; Billing</span></div>
        <div className="card-body">
          {billingError && <div className="alert alert-danger mb-4" role="alert">{billingError}</div>}
          {subscriptionLoading ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : !subscription ? (
            <p className="text-sm text-secondary">No billing subscription record yet.</p>
          ) : (
            <>
              <dl className="platform-detail-list mb-4">
                <div><dt>Plan</dt><dd>{subscription.planName}</dd></div>
                <div><dt>Price</dt><dd>{(() => {
                  const currentPlan = plans.find((plan) => plan.id === subscription.planId);
                  const price = currentPlan?.[`price_${subscription.billingCycle}`];
                  return price !== undefined ? formatCurrency(price, currentPlan.currency) : '—';
                })()}</dd></div>
                <div><dt>Status</dt><dd>{subscription.status}</dd></div>
                <div><dt>Billing Cycle</dt><dd>{subscription.billingCycle}</dd></div>
                <div><dt>Renewal Date</dt><dd>{subscription.renewalDate ? new Date(subscription.renewalDate).toLocaleDateString() : '—'}</dd></div>
                <div><dt>Auto Renew</dt><dd>{subscription.autoRenew ? 'Yes' : 'No'}</dd></div>
                <div><dt>Trial Converted</dt><dd>{subscription.trialConvertedAt ? new Date(subscription.trialConvertedAt).toLocaleDateString() : '—'}</dd></div>
                {subscription.status === 'cancelled' && (
                  <div><dt>Cancellation Reason</dt><dd>{subscription.cancellationReason || '—'}</dd></div>
                )}
                {subscription.status === 'grace_period' && (
                  <div><dt>Grace Period Ends</dt><dd>{subscription.gracePeriodEndsAt ? new Date(subscription.gracePeriodEndsAt).toLocaleDateString() : '—'}</dd></div>
                )}
              </dl>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { resetBilling({ planId: '', billingCycle: subscription.billingCycle }); setBillingActionModal('upgrade'); }}>Upgrade Plan</button>
                <button type="button" className="btn btn-secondary" onClick={() => { resetBilling({ planId: '', billingCycle: subscription.billingCycle }); setBillingActionModal('downgrade'); }}>Downgrade Plan</button>
                <button type="button" className="btn btn-secondary" onClick={() => setBillingPendingConfirm('renew')}>Renew</button>
                {subscription.status === 'cancelled' ? (
                  <button type="button" className="btn btn-primary" onClick={() => setBillingPendingConfirm('resume')}>Resume</button>
                ) : (
                  <button type="button" className="btn btn-danger" onClick={() => setBillingPendingConfirm('cancel')}>Cancel Subscription</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card mt-5">
        <div className="card-header"><span className="card-title">Branches ({branchCount})</span></div>
        <div className="card-body">
          {branches.length === 0 ? <p className="text-sm text-secondary">No branches.</p> : (
            <dl className="platform-detail-list">
              {branches.map((branch) => (
                <div key={branch.id}><dt>{branch.name}</dt><dd>{branch.code} · {branch.status}</dd></div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="card mt-5">
        <div className="card-header"><span className="card-title">Users</span></div>
        <Table columns={userColumns} rows={usersTable.items} loading={usersTable.loading} emptyMessage="No users." />
        <Pagination page={usersTable.page} totalPages={usersTable.meta.totalPages} total={usersTable.meta.total} limit={usersTable.meta.limit} onPageChange={usersTable.setPage} />
      </div>

      <div className="card mt-5">
        <div className="card-header"><span className="card-title">Recent Logins</span></div>
        <div className="card-body">
          {recentLogins.length === 0 ? <p className="text-sm text-secondary">No recent logins.</p> : (
            <dl className="platform-detail-list">
              {recentLogins.map((login) => (
                <div key={login.id}>
                  <dt>{login.first_name} {login.last_name}</dt>
                  <dd>{new Date(login.created_at).toLocaleString()} · {login.ip_address || 'Unknown IP'}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(trialModal)}
        onClose={() => setTrialModal(null)}
        title={trialModal ? TRIAL_ACTION_LABELS[trialModal] : ''}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setTrialModal(null)}>Cancel</button>
            <button type="submit" form="trial-action-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              Confirm
            </button>
          </>
        }
      >
        <form id="trial-action-form" onSubmit={handleSubmit(onSubmitTrialModal)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="days">Days</label>
            <input
              id="days"
              type="number"
              min="1"
              max="365"
              className={`form-control ${errors.days ? 'form-control-error' : ''}`}
              {...register('days', { required: true, min: 1, max: 365 })}
            />
            {errors.days && <span className="form-error">Enter a number between 1 and 365</span>}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingConfirm === 'suspend'}
        onClose={() => setPendingConfirm(null)}
        onConfirm={runConfirmedAction}
        title="Suspend tenant"
        message={`Suspend "${tenant.company_name}"? They will be immediately unable to log in.`}
        confirmLabel="Suspend"
        variant="danger"
      />
      <ConfirmDialog
        open={pendingConfirm === 'activate'}
        onClose={() => setPendingConfirm(null)}
        onConfirm={runConfirmedAction}
        title="Activate tenant"
        message={`Activate "${tenant.company_name}"? They will regain access immediately.`}
        confirmLabel="Activate"
        variant="primary"
      />
      <ConfirmDialog
        open={pendingConfirm === 'activate-subscription'}
        onClose={() => setPendingConfirm(null)}
        onConfirm={runConfirmedAction}
        title="Activate subscription manually"
        message={`Mark "${tenant.company_name}" as a paying, active subscriber?`}
        confirmLabel="Activate Subscription"
        variant="primary"
      />
      <ConfirmDialog
        open={pendingConfirm === 'expire'}
        onClose={() => setPendingConfirm(null)}
        onConfirm={runConfirmedAction}
        title="Expire trial immediately"
        message={`"${tenant.company_name}" will immediately lose access to create new sales, purchases, inventory changes, expenses, and stock transfers.`}
        confirmLabel="Expire Now"
        variant="danger"
      />

      <Modal
        open={Boolean(billingActionModal)}
        onClose={() => setBillingActionModal(null)}
        title={billingActionModal ? BILLING_ACTION_LABELS[billingActionModal] : ''}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setBillingActionModal(null)}>Cancel</button>
            <button type="submit" form="billing-action-form" className={`btn btn-primary ${billingSubmitting ? 'btn-loading' : ''}`} disabled={billingSubmitting}>
              Confirm
            </button>
          </>
        }
      >
        <form id="billing-action-form" onSubmit={handleSubmitBilling(onSubmitBillingModal)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="planId">Plan</label>
            <select
              id="planId"
              className={`form-control ${billingErrors.planId ? 'form-control-error' : ''}`}
              {...registerBilling('planId', { required: true })}
            >
              <option value="">Select a plan…</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
            {billingErrors.planId && <span className="form-error">Select a plan</span>}
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="billingCycle">Billing Cycle</label>
            <select id="billingCycle" className="form-control" {...registerBilling('billingCycle', { required: true })}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={billingPendingConfirm === 'renew'}
        onClose={() => setBillingPendingConfirm(null)}
        onConfirm={runBillingConfirmedAction}
        title="Renew subscription"
        message={`Renew "${tenant.company_name}"'s subscription for one more billing cycle and generate an invoice?`}
        confirmLabel="Renew"
        variant="primary"
      />
      <ConfirmDialog
        open={billingPendingConfirm === 'cancel'}
        onClose={() => setBillingPendingConfirm(null)}
        onConfirm={runBillingConfirmedAction}
        title="Cancel subscription"
        message={`Cancel "${tenant.company_name}"'s subscription? Auto-renewal will be turned off.`}
        confirmLabel="Cancel Subscription"
        variant="danger"
      />
      <ConfirmDialog
        open={billingPendingConfirm === 'resume'}
        onClose={() => setBillingPendingConfirm(null)}
        onConfirm={runBillingConfirmedAction}
        title="Resume subscription"
        message={`Resume "${tenant.company_name}"'s cancelled subscription?`}
        confirmLabel="Resume"
        variant="primary"
      />
    </div>
  );
}

export default TenantDetail;
