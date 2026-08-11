import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as loanService from '../../services/loanService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = {
  submitted: 'badge-neutral', under_review: 'badge-warning', approved: 'badge-info',
  rejected: 'badge-danger', disbursed: 'badge-success', active: 'badge-success',
  completed: 'badge-success', defaulted: 'badge-danger', written_off: 'badge-danger',
};

function LoanList() {
  const { t, i18n } = useTranslation(['microfinance', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('loans.create');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  const fetchLoans = useCallback((params) => loanService.listLoans(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters } = useTable(fetchLoans);

  const columns = [
    { key: 'loan_number', label: t('microfinance:loans.columns.loanNumber') },
    { key: 'borrower', label: t('microfinance:loans.columns.borrower'), render: (row) => `${row.borrower_first_name} ${row.borrower_last_name}` },
    { key: 'amount', label: t('microfinance:loans.columns.amount'), render: (row) => formatCurrency(row.approved_amount || row.requested_amount) },
    { key: 'interest_rate', label: t('microfinance:loans.detail.interestRate'), render: (row) => `${row.interest_rate}%` },
    {
      key: 'status',
      label: t('microfinance:loans.columns.status'),
      render: (row) => <span className={`badge ${STATUS_BADGE[row.status] || 'badge-neutral'}`}>{t(`microfinance:loans.status.${row.status}`)}</span>,
    },
    { key: 'created_at', label: t('microfinance:loans.columns.date'), render: (row) => formatDate(row.created_at) },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/loans/${row.id}`)} aria-label={t('microfinance:loans.list.viewLoan')}>
            <FiEye />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('microfinance:loans.list.title')}</h1>
          <p className="page-subtitle">{t('microfinance:loans.list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/loans/new')}>
              <FiPlus aria-hidden="true" /> {t('microfinance:loans.list.newApplication')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('microfinance:loans.list.searchPlaceholder')} />
          <select
            className="form-control"
            value={filters.status || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value || undefined }))}
          >
            <option value="">{t('microfinance:loans.list.allStatuses')}</option>
            {Object.keys(STATUS_BADGE).map((status) => (
              <option key={status} value={status}>{t(`microfinance:loans.status.${status}`)}</option>
            ))}
          </select>
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('microfinance:loans.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default LoanList;
