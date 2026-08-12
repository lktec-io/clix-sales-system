import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiArrowLeft, FiUsers, FiGrid, FiClock, FiSlash, FiCheckCircle, FiTrash2, FiRotateCcw, FiAlertTriangle, FiAlertOctagon } from 'react-icons/fi';
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
import * as platformBusinessTemplateService from '../../../services/platformBusinessTemplateService';
import { formatCurrency } from '../../../utils/formatCurrency';
import { PLATFORM_ROUTES } from '../../../constants/routes';
import '../../../styles/pages/PlatformTenantDetail.css';

const TRIAL_ACTION_LABELS = {
  extend: 'Extend Trial',
  reduce: 'Reduce Trial',
  reset: 'Reset Trial',
};

const HARD_DELETE_PHRASE = 'PERMANENTLY DELETE';

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
  const [pendingConfirm, setPendingConfirm] = useState(null); // 'suspend' | 'activate' | 'activate-subscription' | 'expire' | 'restore' | null

  // Delete is deliberately its own state, not folded into pendingConfirm's
  // generic ConfirmDialog — it needs a type-the-company-name field
  // ConfirmDialog's fixed API doesn't support, per the explicit "must NOT
  // be a casual accidental click" requirement.
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // TRUE, PERMANENT deletion — a separate action from Delete Tenant above
  // (that one is a reversible status flip; this one genuinely destroys the
  // tenant's data with no restore path). Lives in its own "Danger Zone"
  // card, its own modal, and requires a second, distinct typed phrase on
  // top of the company name so it can never be triggered by the same
  // muscle-memory click that soft-deletes a tenant.
  const [hardDeleteModalOpen, setHardDeleteModalOpen] = useState(false);
  const [hardDeleteConfirmName, setHardDeleteConfirmName] = useState('');
  const [hardDeleteConfirmPhrase, setHardDeleteConfirmPhrase] = useState('');
  const [hardDeleteSubmitting, setHardDeleteSubmitting] = useState(false);
  const [hardDeleteError, setHardDeleteError] = useState('');
  const [hardDeletePreview, setHardDeletePreview] = useState(null);
  const [hardDeletePreviewLoading, setHardDeletePreviewLoading] = useState(false);

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

  // Phase 5 — Business Template & module override card. Same additive
  // pattern as the billing card above: its own state/effect, never folded
  // into load() so the Phase 3 tenant-detail fetch stays untouched.
  const [templates, setTemplates] = useState([]);
  const [moduleOverrides, setModuleOverrides] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState('');

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

  const loadTemplateSection = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const [templateList, overrides] = await Promise.all([
        platformBusinessTemplateService.listTemplates(),
        platformTenantService.getModuleOverrides(id),
      ]);
      setTemplates(templateList.filter((template) => template.status === 'active'));
      setModuleOverrides(overrides);
    } catch {
      // Additive card — never blocks the rest of the page from rendering.
    } finally {
      setTemplateLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    loadBilling();
    loadTemplateSection();
  }, [load, loadBilling, loadTemplateSection]);

  if (loading || !detail) return error ? <div className="alert alert-danger">{error}</div> : <PageSkeleton />;

  const { tenant, company, owner, userCount, branchCount, branches, recentLogins } = detail;
  const daysRemaining = daysRemainingUntil(tenant.trial_ends_at);

  const runConfirmedAction = async () => {
    try {
      if (pendingConfirm === 'suspend') await platformTenantService.suspendTenant(id);
      else if (pendingConfirm === 'activate') await platformTenantService.activateTenant(id);
      else if (pendingConfirm === 'activate-subscription') await platformTenantService.activateSubscription(id);
      else if (pendingConfirm === 'expire') await platformTenantService.expireImmediately(id);
      else if (pendingConfirm === 'restore') await platformTenantService.restoreTenant(id);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    }
  };

  const submitDelete = async () => {
    setDeleteError('');
    setDeleteSubmitting(true);
    try {
      await platformTenantService.deleteTenant(id, deleteConfirmName);
      setDeleteModalOpen(false);
      setDeleteConfirmName('');
      await load();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete tenant.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openHardDeleteModal = async () => {
    setHardDeleteError('');
    setHardDeleteModalOpen(true);
    setHardDeletePreviewLoading(true);
    try {
      const preview = await platformTenantService.getHardDeletePreview(id);
      setHardDeletePreview(preview);
    } catch (err) {
      setHardDeleteError(err.response?.data?.message || 'Failed to load deletion preview.');
    } finally {
      setHardDeletePreviewLoading(false);
    }
  };

  const closeHardDeleteModal = () => {
    setHardDeleteModalOpen(false);
    setHardDeleteConfirmName('');
    setHardDeleteConfirmPhrase('');
    setHardDeleteError('');
    setHardDeletePreview(null);
  };

  const submitHardDelete = async () => {
    setHardDeleteError('');
    setHardDeleteSubmitting(true);
    try {
      await platformTenantService.hardDeleteTenant(id, hardDeleteConfirmName, hardDeleteConfirmPhrase);
      navigate(PLATFORM_ROUTES.TENANTS, { replace: true });
    } catch (err) {
      setHardDeleteError(err.response?.data?.message || 'Failed to permanently delete tenant.');
      setHardDeleteSubmitting(false);
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

  const onChangeTemplate = async () => {
    if (!pendingTemplateId) return;
    setTemplateError('');
    setTemplateSaving(true);
    try {
      await platformTenantService.setBusinessTemplate(id, Number(pendingTemplateId));
      setPendingTemplateId('');
      await Promise.all([load(), loadTemplateSection()]);
    } catch (err) {
      setTemplateError(err.response?.data?.message || 'Failed to change template.');
    } finally {
      setTemplateSaving(false);
    }
  };

  // null = "revert to template default" (a distinct action from
  // "override to enabled/disabled" — see tenantModule.repository.js's
  // clearOverride vs setOverride).
  const onToggleModuleOverride = async (moduleId, nextState) => {
    setTemplateError('');
    try {
      await platformTenantService.setModuleOverride(id, moduleId, nextState);
      await loadTemplateSection();
    } catch (err) {
      setTemplateError(err.response?.data?.message || 'Failed to update module override.');
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
        <div className="page-actions flex gap-2" style={{ flexWrap: 'wrap' }}>
          {tenant.status === 'deleted' ? (
            <button type="button" className="btn btn-primary" onClick={() => setPendingConfirm('restore')}><FiRotateCcw aria-hidden="true" /> Restore</button>
          ) : (
            <>
              {tenant.status === 'active' ? (
                <button type="button" className="btn btn-danger" onClick={() => setPendingConfirm('suspend')}><FiSlash aria-hidden="true" /> Suspend</button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setPendingConfirm('activate')}><FiCheckCircle aria-hidden="true" /> Activate</button>
              )}
              <button type="button" className="btn btn-danger" onClick={() => setDeleteModalOpen(true)}><FiTrash2 aria-hidden="true" /> Delete Tenant</button>
            </>
          )}
        </div>
      </div>

      {tenant.status === 'deleted' && (
        <div className="alert alert-danger mb-4" role="alert">
          <FiAlertTriangle aria-hidden="true" /> This tenant has been deleted. All users are blocked from logging in. Their data is retained (not erased) and everything is fully restorable.
        </div>
      )}

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
        <div className="card-header"><span className="card-title">Business Template &amp; Modules</span></div>
        <div className="card-body">
          {templateError && <div className="alert alert-danger mb-4" role="alert">{templateError}</div>}
          {templateLoading ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : (
            <>
              <p className="text-sm text-secondary mb-2">
                A template sets this tenant's DEFAULT modules only — every module below can still be enabled or disabled individually, regardless of template.
              </p>
              <div className="flex gap-2 items-center mb-4" style={{ flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  style={{ maxWidth: 260 }}
                  value={pendingTemplateId}
                  onChange={(event) => setPendingTemplateId(event.target.value)}
                >
                  <option value="">Change template…</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <button
                  type="button" className={`btn btn-secondary ${templateSaving ? 'btn-loading' : ''}`}
                  disabled={!pendingTemplateId || templateSaving} onClick={onChangeTemplate}
                >
                  Assign Template
                </button>
              </div>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {moduleOverrides.map((row) => {
                  const effectivelyEnabled = row.is_core || (row.override_enabled ?? row.template_enabled);
                  const hasOverride = row.override_enabled !== null && row.override_enabled !== undefined;
                  return (
                    <li key={row.module_id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span className="flex items-center gap-2">
                        {row.name}
                        {row.is_core && <span className="badge badge-info">Core</span>}
                        {!row.is_core && hasOverride && <span className="badge badge-warning">Overridden</span>}
                        {!row.is_active && !row.is_core && <span className="badge badge-neutral">Not yet available</span>}
                      </span>
                      {!row.is_core && (
                        <span className="flex gap-1">
                          <button
                            type="button" className={`btn btn-sm ${effectivelyEnabled ? 'btn-primary' : 'btn-secondary'}`} disabled={!row.is_active}
                            onClick={() => onToggleModuleOverride(row.module_id, true)}
                          >
                            Enable
                          </button>
                          <button
                            type="button" className={`btn btn-sm ${!effectivelyEnabled ? 'btn-primary' : 'btn-secondary'}`} disabled={!row.is_active}
                            onClick={() => onToggleModuleOverride(row.module_id, false)}
                          >
                            Disable
                          </button>
                          {hasOverride && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onToggleModuleOverride(row.module_id, null)}>
                              Reset to template default
                            </button>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
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

      <div className="card mt-5" style={{ borderColor: 'var(--color-danger)' }}>
        <div className="card-header"><span className="card-title flex items-center gap-2"><FiAlertOctagon aria-hidden="true" /> Danger Zone</span></div>
        <div className="card-body">
          <p className="text-sm mb-3">
            Permanently and irreversibly delete <strong>{tenant.company_name}</strong> and every record it owns —
            users, branches, sales, inventory, invoices, payments, notifications, and all other business data. This is
            separate from Delete Tenant above: there is no restore afterward. Use this only to clean up test or trial
            tenants you are certain you no longer need.
          </p>
          <button type="button" className="btn btn-danger" onClick={openHardDeleteModal}>
            <FiAlertOctagon aria-hidden="true" /> Delete Permanently
          </button>
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
        open={pendingConfirm === 'restore'}
        onClose={() => setPendingConfirm(null)}
        onConfirm={runConfirmedAction}
        title="Restore tenant"
        message={`Restore "${tenant.company_name}"? All their data was retained — access will be fully reinstated immediately.`}
        confirmLabel="Restore"
        variant="primary"
      />

      <Modal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteConfirmName(''); setDeleteError(''); }}
        title="Delete tenant"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setDeleteModalOpen(false); setDeleteConfirmName(''); }}>Cancel</button>
            <button
              type="button" className={`btn btn-danger ${deleteSubmitting ? 'btn-loading' : ''}`}
              disabled={deleteSubmitting || deleteConfirmName !== tenant.company_name}
              onClick={submitDelete}
            >
              Delete Tenant
            </button>
          </>
        }
      >
        {deleteError && <div className="alert alert-danger mb-4" role="alert">{deleteError}</div>}
        <p className="text-sm mb-3">
          This will immediately block every user of <strong>{tenant.company_name}</strong> from logging in. Their data is
          retained (not erased) for billing and audit purposes, and this can be undone by restoring the tenant later.
        </p>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="deleteConfirmName">
            Type <strong>{tenant.company_name}</strong> to confirm
          </label>
          <input
            id="deleteConfirmName"
            type="text"
            className="form-control"
            value={deleteConfirmName}
            onChange={(event) => setDeleteConfirmName(event.target.value)}
            autoComplete="off"
          />
        </div>
      </Modal>
      <Modal
        open={hardDeleteModalOpen}
        onClose={closeHardDeleteModal}
        title="Delete tenant permanently"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeHardDeleteModal}>Cancel</button>
            <button
              type="button" className={`btn btn-danger ${hardDeleteSubmitting ? 'btn-loading' : ''}`}
              disabled={
                hardDeleteSubmitting || hardDeletePreviewLoading
                || hardDeleteConfirmName !== tenant.company_name
                || hardDeleteConfirmPhrase !== HARD_DELETE_PHRASE
              }
              onClick={submitHardDelete}
            >
              Delete Permanently
            </button>
          </>
        }
      >
        {hardDeleteError && <div className="alert alert-danger mb-4" role="alert">{hardDeleteError}</div>}
        <div className="alert alert-danger mb-4" role="alert">
          <FiAlertTriangle aria-hidden="true" /> This cannot be undone. Every row this tenant owns will be permanently
          destroyed, not just hidden.
        </div>

        {hardDeletePreviewLoading ? (
          <p className="text-sm text-secondary mb-3">Loading what will be deleted…</p>
        ) : hardDeletePreview ? (
          <div className="mb-3">
            <p className="text-sm mb-2">
              This will destroy <strong>{hardDeletePreview.totalRows.toLocaleString()}</strong> total records across
              {' '}{Object.keys(hardDeletePreview.rowCounts).length} tables, including:
            </p>
            <ul className="text-sm text-secondary" style={{ margin: 0, paddingLeft: '1.25rem', maxHeight: 160, overflowY: 'auto' }}>
              {Object.entries(hardDeletePreview.rowCounts)
                .filter(([, count]) => count)
                .sort(([, a], [, b]) => b - a)
                .map(([table, count]) => <li key={table}>{table}: {count.toLocaleString()}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="hardDeleteConfirmName">
            Type <strong>{tenant.company_name}</strong> to confirm
          </label>
          <input
            id="hardDeleteConfirmName"
            type="text"
            className="form-control"
            value={hardDeleteConfirmName}
            onChange={(event) => setHardDeleteConfirmName(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="form-group mb-0">
          <label className="form-label form-label-required" htmlFor="hardDeleteConfirmPhrase">
            Type <strong>{HARD_DELETE_PHRASE}</strong> to confirm
          </label>
          <input
            id="hardDeleteConfirmPhrase"
            type="text"
            className="form-control"
            value={hardDeleteConfirmPhrase}
            onChange={(event) => setHardDeleteConfirmPhrase(event.target.value)}
            autoComplete="off"
          />
        </div>
      </Modal>

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
