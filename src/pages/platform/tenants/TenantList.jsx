import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiSlash, FiCheckCircle } from 'react-icons/fi';
import Table from '../../../components/common/Table';
import Pagination from '../../../components/common/Pagination';
import SearchInput from '../../../components/common/SearchInput';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import StatusFilterDropdown from '../../../components/platform/StatusFilterDropdown';
import { useTable } from '../../../hooks/useTable';
import * as platformTenantService from '../../../services/platformTenantService';
import { PLATFORM_ROUTES } from '../../../constants/routes';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deleted', label: 'Deleted' },
];

const STATUS_LABELS = { active: 'Active', suspended: 'Suspended', deleted: 'Deleted' };

const SUBSCRIPTION_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Subscribed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

function subscriptionBadgeClass(status) {
  if (status === 'active') return 'badge-success';
  if (status === 'trial') return 'badge-info';
  if (status === 'expired') return 'badge-danger';
  return 'badge-neutral';
}

function TenantList() {
  const navigate = useNavigate();
  const fetchTenants = useCallback((params) => platformTenantService.listTenants(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters, refetch } = useTable(fetchTenants);
  const [actionError, setActionError] = useState('');
  const [pendingToggle, setPendingToggle] = useState(null);

  const handleToggleStatus = async () => {
    try {
      if (pendingToggle.status === 'active') {
        await platformTenantService.suspendTenant(pendingToggle.id);
      } else {
        await platformTenantService.activateTenant(pendingToggle.id);
      }
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update tenant status.');
    }
  };

  const columns = [
    { key: 'company_name', label: 'Company', render: (row) => (
      <div>
        <div>{row.company_name}</div>
        <div className="text-xs text-secondary">{row.company_code}</div>
      </div>
    ) },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
        {STATUS_LABELS[row.status] || row.status}
      </span>
    ) },
    { key: 'subscription_status', label: 'Plan', render: (row) => (
      <span className={`badge ${subscriptionBadgeClass(row.subscription_status)}`}>
        {row.subscription_status.charAt(0).toUpperCase() + row.subscription_status.slice(1)}
      </span>
    ) },
    { key: 'trial_ends_at', label: 'Trial Expiry', render: (row) => (row.trial_ends_at ? new Date(row.trial_ends_at).toLocaleDateString() : '—') },
    { key: 'created_at', label: 'Registered', render: (row) => new Date(row.created_at).toLocaleDateString() },
    { key: 'actions', label: '', render: (row) => (
      <div className="table-actions">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`${PLATFORM_ROUTES.TENANTS}/${row.id}`)} aria-label="View tenant">
          <FiEye />
        </button>
        {/* Deleted tenants are only ever restored from TenantDetail's
            dedicated flow — no quick row-level toggle for that state, to
            keep restore as deliberate as delete itself. */}
        {row.status !== 'deleted' && (
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setPendingToggle(row)}
            aria-label={row.status === 'active' ? 'Suspend tenant' : 'Activate tenant'}
          >
            {row.status === 'active' ? <FiSlash /> : <FiCheckCircle />}
          </button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tenants</h1>
          <p className="page-subtitle">Every company registered on Clix Sales System.</p>
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by company name or code…" />
          <div className="flex gap-2">
            <StatusFilterDropdown
              label="Status"
              value={filters.status || ''}
              options={STATUS_OPTIONS}
              onChange={(status) => setFilters((prev) => ({ ...prev, status: status || undefined }))}
            />
            <StatusFilterDropdown
              label="Plan"
              value={filters.subscriptionStatus || ''}
              options={SUBSCRIPTION_OPTIONS}
              onChange={(subscriptionStatus) => setFilters((prev) => ({ ...prev, subscriptionStatus: subscriptionStatus || undefined }))}
            />
          </div>
        </div>

        <Table columns={columns} rows={items} loading={loading} emptyMessage="No tenants found." />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <ConfirmDialog
        open={Boolean(pendingToggle)}
        onClose={() => setPendingToggle(null)}
        onConfirm={handleToggleStatus}
        title={pendingToggle?.status === 'active' ? 'Suspend tenant' : 'Activate tenant'}
        message={
          pendingToggle?.status === 'active'
            ? `Suspend "${pendingToggle?.company_name}"? They will be immediately unable to log in.`
            : `Activate "${pendingToggle?.company_name}"? They will regain access immediately.`
        }
        confirmLabel={pendingToggle?.status === 'active' ? 'Suspend' : 'Activate'}
        variant={pendingToggle?.status === 'active' ? 'danger' : 'primary'}
      />
    </div>
  );
}

export default TenantList;
