import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as returnService from '../../services/returnService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
};

function ReturnList() {
  const { t, i18n } = useTranslation(['returns', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('returns.create');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  const REASON_LABELS = {
    damaged: t('returns:reasons.damaged'),
    wrong_item: t('returns:reasons.wrongItem'),
    changed_mind: t('returns:reasons.changedMind'),
    expired: t('returns:reasons.expired'),
    other: t('returns:reasons.other'),
  };

  const STATUS_LABELS = {
    pending: t('returns:status.pending'),
    approved: t('returns:status.approved'),
    rejected: t('returns:status.rejected'),
  };

  const fetchReturns = useCallback((params) => returnService.listReturns(params), []);
  const { items, meta, loading, page, setPage, search, setSearch } = useTable(fetchReturns);

  const columns = [
    { key: 'return_number', label: t('returns:columns.returnNumber') },
    { key: 'sale_number', label: t('returns:columns.originalSale') },
    {
      key: 'customer',
      label: t('returns:columns.customer'),
      render: (row) => (row.customer_first_name ? `${row.customer_first_name} ${row.customer_last_name}` : t('returns:list.walkIn')),
    },
    { key: 'reason', label: t('returns:columns.reason'), render: (row) => REASON_LABELS[row.reason] || row.reason },
    { key: 'refund_amount', label: t('returns:columns.refund'), render: (row) => (row.refund_amount != null ? formatCurrency(row.refund_amount) : '—') },
    { key: 'created_at', label: t('returns:columns.date'), render: (row) => formatDate(row.created_at) },
    {
      key: 'status',
      label: t('returns:columns.status'),
      render: (row) => <span className={`badge ${STATUS_BADGE[row.status] || 'badge-neutral'}`}>{STATUS_LABELS[row.status] || row.status}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/returns/${row.id}`)} aria-label={t('returns:list.viewReturnAria')}>
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
          <h1 className="page-title">{t('returns:list.title')}</h1>
          <p className="page-subtitle">{t('returns:list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/returns/new')}>
              <FiPlus aria-hidden="true" /> {t('returns:list.newReturn')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('returns:list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('returns:list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default ReturnList;
