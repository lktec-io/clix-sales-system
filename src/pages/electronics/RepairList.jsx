import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as repairService from '../../services/repairService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = {
  received: 'badge-neutral', diagnosis: 'badge-info', waiting_approval: 'badge-warning',
  approved: 'badge-info', in_repair: 'badge-info', ready_for_collection: 'badge-warning',
  completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger', unrepairable: 'badge-danger',
};

const DEVICE_TYPES = ['smartphone', 'tablet', 'laptop', 'desktop', 'printer', 'other'];

function RepairList() {
  const { t, i18n } = useTranslation(['electronics', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('repairs.create');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => (isoString ? new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' }) : '—');

  const fetchRepairs = useCallback((params) => repairService.listRepairs(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters } = useTable(fetchRepairs);

  // Trimmed to exactly the columns a technician actually scans for at a
  // glance (repair #/customer/device/status/balance/date) — Technician and
  // separate Total/Paid columns were dropped from the list view (still
  // fully visible on Repair Detail) so this stays a fast, technician-
  // friendly list instead of a wide enterprise data table.
  const columns = [
    { key: 'repair_number', label: t('electronics:repairs.columns.repairNumber') },
    { key: 'customer', label: t('electronics:repairs.columns.customer'), render: (row) => `${row.customer_first_name} ${row.customer_last_name}` },
    { key: 'device', label: t('electronics:repairs.columns.device'), render: (row) => `${row.brand} ${row.model}` },
    {
      key: 'status',
      label: t('electronics:repairs.columns.status'),
      render: (row) => <span className={`badge ${STATUS_BADGE[row.status] || 'badge-neutral'}`}>{t(`electronics:repairs.status.${row.status}`)}</span>,
    },
    { key: 'balance', label: t('electronics:repairs.columns.balance'), render: (row) => formatCurrency(row.balance) },
    { key: 'received_at', label: t('electronics:repairs.columns.received'), render: (row) => formatDate(row.received_at) },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/repairs/${row.id}`)} aria-label={t('electronics:repairs.list.viewRepair')}>
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
          <h1 className="page-title">{t('electronics:repairs.list.title')}</h1>
          <p className="page-subtitle">{t('electronics:repairs.list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/repairs/new')}>
              <FiPlus aria-hidden="true" /> {t('electronics:repairs.list.newRepair')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('electronics:repairs.list.searchPlaceholder')} />
          <select
            className="form-control"
            value={filters.status || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value || undefined }))}
          >
            <option value="">{t('electronics:repairs.list.allStatuses')}</option>
            {Object.keys(STATUS_BADGE).map((status) => (
              <option key={status} value={status}>{t(`electronics:repairs.status.${status}`)}</option>
            ))}
          </select>
          <select
            className="form-control"
            value={filters.deviceType || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, deviceType: e.target.value || undefined }))}
          >
            <option value="">{t('electronics:repairs.list.allDeviceTypes')}</option>
            {DEVICE_TYPES.map((type) => (
              <option key={type} value={type}>{t(`electronics:repairs.deviceTypes.${type}`)}</option>
            ))}
          </select>
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('electronics:repairs.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default RepairList;
