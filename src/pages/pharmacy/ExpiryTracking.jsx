import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import { useTable } from '../../hooks/useTable';
import * as medicineService from '../../services/medicineService';
import * as branchService from '../../services/branchService';

const STATUS_FILTERS = ['all', 'expired', 'expiring_soon', 'valid'];
const STATUS_BADGE = { expired: 'badge-danger', expiring_soon: 'badge-warning', valid: 'badge-success' };

function daysRemaining(expiryDate) {
  return Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
}

function rowStatus(days) {
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'valid';
}

function ExpiryTracking() {
  const { t, i18n } = useTranslation(['pharmacy', 'common']);
  const [branches, setBranches] = useState([]);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  useEffect(() => {
    branchService.listActiveBranches().then(setBranches);
  }, []);

  const fetchExpiring = useCallback((params) => medicineService.listExpiring(params), []);
  const { items, meta, loading, page, setPage, filters, setFilters } = useTable(fetchExpiring, { initialFilters: { status: '' } });

  const columns = [
    { key: 'medicine_name', label: t('pharmacy:expiry.columns.medicine') },
    { key: 'batch_number', label: t('pharmacy:expiry.columns.batch') },
    { key: 'expiry_date', label: t('pharmacy:expiry.columns.expiryDate'), render: (row) => formatDate(row.expiry_date) },
    { key: 'quantity', label: t('pharmacy:expiry.columns.quantity') },
    { key: 'daysRemaining', label: t('pharmacy:expiry.columns.daysRemaining'), render: (row) => daysRemaining(row.expiry_date) },
    {
      key: 'status',
      label: t('pharmacy:expiry.columns.status'),
      render: (row) => {
        const status = rowStatus(daysRemaining(row.expiry_date));
        return <span className={`badge ${STATUS_BADGE[status]}`}>{t(`pharmacy:expiry.status.${status}`)}</span>;
      },
    },
    { key: 'branch_name', label: t('pharmacy:expiry.columns.branch') },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pharmacy:expiry.list.title')}</h1>
          <p className="page-subtitle">{t('pharmacy:expiry.list.subtitle')}</p>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <select
            className="form-control"
            value={filters.status || 'all'}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value === 'all' ? '' : e.target.value }))}
          >
            {STATUS_FILTERS.map((status) => <option key={status} value={status}>{t(`pharmacy:expiry.tabs.${status}`)}</option>)}
          </select>
          {branches.length > 1 && (
            <select
              className="form-control"
              value={filters.branchId || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value || undefined }))}
            >
              <option value="">{t('pharmacy:expiry.list.allBranches')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('pharmacy:expiry.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default ExpiryTracking;
