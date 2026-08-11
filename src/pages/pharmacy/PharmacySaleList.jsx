import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as pharmacySaleService from '../../services/pharmacySaleService';
import { formatCurrency } from '../../utils/formatCurrency';

function PharmacySaleList() {
  const { t, i18n } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('pharmacy_sales.create');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  const fetchSales = useCallback((params) => pharmacySaleService.listSales(params), []);
  const { items, meta, loading, page, setPage, search, setSearch } = useTable(fetchSales);

  const columns = [
    { key: 'sale_number', label: t('pharmacy:sales.columns.saleNumber') },
    {
      key: 'customer',
      label: t('pharmacy:sales.columns.customer'),
      render: (row) => (row.customer_first_name ? `${row.customer_first_name} ${row.customer_last_name}` : t('pharmacy:sales.walkIn')),
    },
    { key: 'branch_name', label: t('pharmacy:sales.columns.branch') },
    { key: 'total_amount', label: t('pharmacy:sales.columns.total'), render: (row) => formatCurrency(row.total_amount) },
    { key: 'payment_method', label: t('pharmacy:sales.columns.paymentMethod'), render: (row) => t(`pharmacy:sales.paymentMethods.${row.payment_method}`) },
    { key: 'created_at', label: t('pharmacy:sales.columns.date'), render: (row) => formatDate(row.created_at) },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/pharmacy/sales/${row.id}`)} aria-label={t('pharmacy:sales.list.viewSale')}>
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
          <h1 className="page-title">{t('pharmacy:sales.list.title')}</h1>
          <p className="page-subtitle">{t('pharmacy:sales.list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/pharmacy/sales/new')}>
              <FiPlus aria-hidden="true" /> {t('pharmacy:sales.list.newSale')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('pharmacy:sales.list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('pharmacy:sales.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default PharmacySaleList;
