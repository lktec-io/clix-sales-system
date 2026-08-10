import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiShoppingBag, FiDollarSign, FiRotateCcw } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import PageSkeleton from '../../components/common/PageSkeleton';
import KPICard from '../../components/dashboard/KPICard';
import { useTable } from '../../hooks/useTable';
import { useModules } from '../../hooks/useModules';
import * as customerService from '../../services/customerService';
import * as loanService from '../../services/loanService';
import { formatCurrency } from '../../utils/formatCurrency';

const LOAN_STATUS_BADGE = {
  submitted: 'badge-neutral', under_review: 'badge-warning', approved: 'badge-info',
  rejected: 'badge-danger', disbursed: 'badge-success', active: 'badge-success',
  completed: 'badge-success', defaulted: 'badge-danger', written_off: 'badge-danger',
};

function CustomerDetail() {
  const { t, i18n } = useTranslation(['customers', 'sales', 'returns', 'microfinance', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const { isModuleEnabled } = useModules();
  const showSales = isModuleEnabled('sales');
  const showReturns = isModuleEnabled('returns');
  const showLoans = isModuleEnabled('loans');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(showLoans);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  const CUSTOMER_TYPE_LABELS = {
    walk_in: t('customers:types.walkIn'),
    retail: t('customers:types.retail'),
    wholesale: t('customers:types.wholesale'),
    vip: t('customers:types.vip'),
    business: t('customers:types.business'),
  };

  const SALE_STATUS_LABELS = {
    completed: t('sales:status.completed'),
    voided: t('sales:status.voided'),
  };

  const RETURN_STATUS_LABELS = {
    pending: t('returns:status.pending'),
    approved: t('returns:status.approved'),
    rejected: t('returns:status.rejected'),
  };

  const RETURN_REASON_LABELS = {
    damaged: t('returns:reasons.damaged'),
    wrong_item: t('returns:reasons.wrongItem'),
    changed_mind: t('returns:reasons.changedMind'),
    expired: t('returns:reasons.expired'),
    other: t('returns:reasons.other'),
  };

  const fetchPurchases = useCallback((params) => customerService.getCustomerPurchaseHistory(id, params), [id]);
  const purchases = useTable(fetchPurchases);

  const fetchReturns = useCallback((params) => customerService.getCustomerReturnHistory(id, params), [id]);
  const returns = useTable(fetchReturns);

  useEffect(() => {
    customerService.getCustomer(id).then((data) => {
      setCustomer(data);
      setLoading(false);
    });
  }, [id]);

  // Borrower's loan history — only fetched for a tenant whose template
  // actually includes Loans (Microfinance), same "skip the call entirely
  // for a module the tenant doesn't have" principle Dashboard.jsx already
  // applies to its own widgets.
  useEffect(() => {
    if (!showLoans) return;
    loanService.listLoans({ customerId: id, limit: 100 }).then((result) => {
      setLoans(result.items);
      setLoansLoading(false);
    });
  }, [id, showLoans]);

  const purchaseColumns = [
    { key: 'sale_number', label: t('customers:columns.saleNumber') },
    { key: 'created_at', label: t('customers:columns.date'), render: (row) => formatDate(row.created_at) },
    { key: 'total_amount', label: t('customers:columns.amount'), render: (row) => formatCurrency(row.total_amount) },
    { key: 'status', label: t('customers:columns.status'), render: (row) => <span className="badge badge-neutral">{SALE_STATUS_LABELS[row.status] || row.status}</span> },
  ];

  const returnColumns = [
    { key: 'return_number', label: t('customers:columns.returnNumber') },
    { key: 'created_at', label: t('customers:columns.date'), render: (row) => formatDate(row.created_at) },
    { key: 'reason', label: t('customers:columns.reason'), render: (row) => RETURN_REASON_LABELS[row.reason] || row.reason },
    { key: 'refund_amount', label: t('customers:columns.refund'), render: (row) => (row.refund_amount != null ? formatCurrency(row.refund_amount) : '—') },
    { key: 'status', label: t('customers:columns.status'), render: (row) => <span className="badge badge-neutral">{RETURN_STATUS_LABELS[row.status] || row.status}</span> },
  ];

  const loanColumns = [
    { key: 'loan_number', label: t('microfinance:loans.columns.loanNumber') },
    { key: 'loan_product_name', label: t('microfinance:loans.columns.product') },
    { key: 'amount', label: t('microfinance:loans.columns.amount'), render: (row) => formatCurrency(row.approved_amount || row.requested_amount) },
    {
      key: 'outstanding',
      label: t('microfinance:loans.detail.outstandingBalance'),
      render: (row) => (row.status === 'active' ? formatCurrency(Number(row.principal_outstanding) + Number(row.interest_outstanding)) : '—'),
    },
    {
      key: 'status',
      label: t('microfinance:loans.columns.status'),
      render: (row) => <span className={`badge ${LOAN_STATUS_BADGE[row.status] || 'badge-neutral'}`}>{t(`microfinance:loans.status.${row.status}`)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/loans/${row.id}`)}>
          {t('microfinance:loans.list.viewLoan')}
        </button>
      ),
    },
  ];

  if (loading || !customer) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/customers')}>
            <FiArrowLeft aria-hidden="true" /> {t('customers:detail.backToCustomers')}
          </button>
          <h1 className="page-title">{customer.first_name} {customer.last_name}</h1>
          <p className="page-subtitle">
            {customer.customer_code} · {customer.phone} · {CUSTOMER_TYPE_LABELS[customer.customer_type] || customer.customer_type}
            {customer.business_name ? ` · ${customer.business_name}` : ''}
          </p>
        </div>
      </div>

      {(showSales || showReturns) && (
        <div className="grid grid-cols-3 mb-5">
          {showSales && <KPICard icon={FiShoppingBag} label={t('customers:detail.totalOrders')} value={customer.totalOrders} />}
          {showSales && <KPICard icon={FiDollarSign} label={t('customers:detail.totalSpent')} value={customer.totalSpent} formatter={(v) => formatCurrency(v)} />}
          {showReturns && <KPICard icon={FiRotateCcw} label={t('customers:detail.totalReturns')} value={customer.totalReturns} />}
        </div>
      )}

      {showLoans && (
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('microfinance:loans.list.title')}</span></div>
          <Table columns={loanColumns} rows={loans} loading={loansLoading} emptyMessage={t('microfinance:loans.list.emptyMessage')} />
        </div>
      )}

      {showSales && (
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('customers:detail.purchaseHistory')}</span></div>
          <Table columns={purchaseColumns} rows={purchases.items} loading={purchases.loading} emptyMessage={t('customers:detail.noPurchases')} />
          <Pagination page={purchases.page} totalPages={purchases.meta.totalPages} total={purchases.meta.total} limit={purchases.meta.limit} onPageChange={purchases.setPage} />
        </div>
      )}

      {showReturns && (
        <div className="card">
          <div className="card-header"><span className="card-title">{t('customers:detail.returnHistory')}</span></div>
          <Table columns={returnColumns} rows={returns.items} loading={returns.loading} emptyMessage={t('customers:detail.noReturns')} />
          <Pagination page={returns.page} totalPages={returns.meta.totalPages} total={returns.meta.total} limit={returns.meta.limit} onPageChange={returns.setPage} />
        </div>
      )}
    </div>
  );
}

export default CustomerDetail;
