import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as restaurantOrderService from '../../services/restaurantOrderService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = {
  open: 'badge-neutral', sent_to_kitchen: 'badge-info', preparing: 'badge-info',
  ready: 'badge-warning', served: 'badge-warning', paid: 'badge-success',
  completed: 'badge-success', cancelled: 'badge-danger',
};

function OrderList() {
  const { t, i18n } = useTranslation(['restaurant', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('restaurant_orders.create');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const fetchOrders = useCallback((params) => restaurantOrderService.listOrders(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters } = useTable(fetchOrders);

  const columns = [
    { key: 'order_number', label: t('restaurant:orders.columns.orderNumber') },
    { key: 'table_number', label: t('restaurant:orders.columns.table'), render: (row) => row.table_number || t('restaurant:orders.takeaway') },
    { key: 'branch_name', label: t('restaurant:orders.columns.branch') },
    { key: 'total_amount', label: t('restaurant:orders.columns.total'), render: (row) => formatCurrency(row.total_amount) },
    {
      key: 'status',
      label: t('restaurant:orders.columns.status'),
      render: (row) => <span className={`badge ${STATUS_BADGE[row.status] || 'badge-neutral'}`}>{t(`restaurant:orders.status.${row.status}`)}</span>,
    },
    { key: 'created_at', label: t('restaurant:orders.columns.date'), render: (row) => formatDateTime(row.created_at) },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/restaurant/orders/${row.id}`)} aria-label={t('restaurant:orders.list.viewOrder')}>
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
          <h1 className="page-title">{t('restaurant:orders.list.title')}</h1>
          <p className="page-subtitle">{t('restaurant:orders.list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/restaurant/orders/new')}>
              <FiPlus aria-hidden="true" /> {t('restaurant:orders.list.newOrder')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('restaurant:orders.list.searchPlaceholder')} />
          <select
            className="form-control"
            value={filters.status || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value || undefined }))}
          >
            <option value="">{t('restaurant:orders.list.allStatuses')}</option>
            {Object.keys(STATUS_BADGE).map((status) => (
              <option key={status} value={status}>{t(`restaurant:orders.status.${status}`)}</option>
            ))}
          </select>
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('restaurant:orders.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default OrderList;
