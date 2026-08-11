import { useCallback, useState } from 'react';
import Table from '../../../components/common/Table';
import Pagination from '../../../components/common/Pagination';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import StatusFilterDropdown from '../../../components/platform/StatusFilterDropdown';
import { useTable } from '../../../hooks/useTable';
import * as platformPaymentService from '../../../services/platformPaymentService';
import { formatCurrency } from '../../../utils/formatCurrency';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function statusBadgeClass(status) {
  if (status === 'succeeded') return 'badge-success';
  if (status === 'failed' || status === 'cancelled') return 'badge-danger';
  if (status === 'processing') return 'badge-info';
  return 'badge-neutral';
}

// Today's actual confirmation path — no live payment gateway is
// configured (see backend/services/paymentProviders/manualPaymentProvider
// .js), so every pending payment here was requested by a tenant via
// BillingOverview.jsx's checkout flow and paid by an existing offline
// channel (mobile money/bank transfer). Confirm/Reject is a platform
// admin verifying that money actually arrived — the same trust boundary
// a real gateway's webhook will occupy automatically once one is
// configured, with zero change to this page.
function PaymentList() {
  const fetchPayments = useCallback((params) => platformPaymentService.listPayments(params), []);
  const { items, meta, loading, page, setPage, filters, setFilters, refetch } = useTable(fetchPayments);
  const [actionError, setActionError] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [pendingReject, setPendingReject] = useState(null);

  const handleConfirm = async () => {
    try {
      await platformPaymentService.confirmPayment(pendingConfirm.id);
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to confirm payment.');
    }
  };

  const handleReject = async () => {
    try {
      await platformPaymentService.rejectPayment(pendingReject.id);
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject payment.');
    }
  };

  const columns = [
    { key: 'internal_reference', label: 'Reference', render: (row) => <code>{row.internal_reference}</code> },
    { key: 'company_name', label: 'Tenant' },
    { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount, row.currency) },
    { key: 'provider', label: 'Provider' },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`badge ${statusBadgeClass(row.status)}`}>{row.status}</span>
    ) },
    { key: 'created_at', label: 'Requested', render: (row) => new Date(row.created_at).toLocaleString() },
    { key: 'actions', label: '', render: (row) => (
      row.status === 'pending' || row.status === 'processing' ? (
        <div className="table-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setPendingConfirm(row)}>Confirm</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingReject(row)}>Reject</button>
        </div>
      ) : null
    ) },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Every payment request across all tenants — confirm once funds are received.</p>
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <div className="table-toolbar">
          <StatusFilterDropdown
            label="Status"
            value={filters.status || ''}
            options={STATUS_OPTIONS}
            onChange={(status) => setFilters((prev) => ({ ...prev, status: status || undefined }))}
          />
        </div>

        <Table columns={columns} rows={items} loading={loading} emptyMessage="No payments found." />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        onClose={() => setPendingConfirm(null)}
        onConfirm={handleConfirm}
        title="Confirm payment"
        message={`Confirm that "${pendingConfirm?.company_name}"'s payment of ${pendingConfirm ? formatCurrency(pendingConfirm.amount, pendingConfirm.currency) : ''} was received? This activates their subscription.`}
        confirmLabel="Confirm Payment"
        variant="primary"
      />
      <ConfirmDialog
        open={Boolean(pendingReject)}
        onClose={() => setPendingReject(null)}
        onConfirm={handleReject}
        title="Reject payment"
        message={`Reject "${pendingReject?.company_name}"'s payment request? They will need to try again.`}
        confirmLabel="Reject"
        variant="danger"
      />
    </div>
  );
}

export default PaymentList;
