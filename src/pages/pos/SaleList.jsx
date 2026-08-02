import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiEye, FiPrinter, FiShoppingCart } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import * as saleService from '../../services/saleService';
import { formatCurrency } from '../../utils/formatCurrency';

function SaleList() {
  const { t, i18n } = useTranslation(['sales', 'common']);
  const navigate = useNavigate();

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const SALE_STATUS_LABELS = {
    completed: t('sales:status.completed'),
    voided: t('sales:status.voided'),
  };

  const fetchSales = useCallback((params) => saleService.listSales(params), []);
  const { items, meta, loading, page, setPage, search, setSearch } = useTable(fetchSales);

  const columns = [
    { key: 'sale_number', label: t('sales:columns.saleNumber') },
    {
      key: 'customer',
      label: t('sales:columns.customer'),
      render: (row) => (row.customer_first_name ? `${row.customer_first_name} ${row.customer_last_name}` : t('sales:list.walkIn')),
    },
    { key: 'cashier', label: t('sales:columns.cashier'), render: (row) => `${row.cashier_first_name} ${row.cashier_last_name}` },
    { key: 'branch_name', label: t('sales:columns.branch') },
    { key: 'created_at', label: t('sales:columns.date'), render: (row) => formatDateTime(row.created_at) },
    { key: 'discount_amount', label: t('sales:columns.discount'), render: (row) => (Number(row.discount_amount) > 0 ? formatCurrency(row.discount_amount) : '—') },
    { key: 'total_amount', label: t('sales:columns.amount'), render: (row) => formatCurrency(row.total_amount) },
    {
      key: 'status',
      label: t('sales:columns.status'),
      render: (row) => <span className={`badge ${row.status === 'voided' ? 'badge-danger' : 'badge-success'}`}>{SALE_STATUS_LABELS[row.status] || row.status}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/pos/sales/${row.id}`)} aria-label={t('sales:list.viewSaleAria')}>
            <FiEye />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => saleService.printReceipt(row.id)} aria-label={t('sales:list.reprintReceiptAria')}>
            <FiPrinter />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('sales:list.title')}</h1>
          <p className="page-subtitle">{t('sales:list.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/pos')}>
            <FiShoppingCart aria-hidden="true" /> {t('sales:list.newSale')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('sales:list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('sales:list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default SaleList;
