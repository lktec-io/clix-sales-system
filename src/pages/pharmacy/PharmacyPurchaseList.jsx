import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as pharmacyPurchaseService from '../../services/pharmacyPurchaseService';
import { formatCurrency } from '../../utils/formatCurrency';

function PharmacyPurchaseList() {
  const { t, i18n } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('pharmacy_purchases.create');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  const fetchPurchases = useCallback((params) => pharmacyPurchaseService.listPurchases(params), []);
  const { items, meta, loading, page, setPage, search, setSearch } = useTable(fetchPurchases);

  const columns = [
    { key: 'purchase_number', label: t('pharmacy:purchases.columns.purchaseNumber') },
    { key: 'supplier_name', label: t('pharmacy:purchases.columns.supplier') },
    { key: 'branch_name', label: t('pharmacy:purchases.columns.branch') },
    { key: 'total_amount', label: t('pharmacy:purchases.columns.total'), render: (row) => formatCurrency(row.total_amount) },
    { key: 'purchase_date', label: t('pharmacy:purchases.columns.date'), render: (row) => formatDate(row.purchase_date) },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/pharmacy/purchases/${row.id}`)} aria-label={t('pharmacy:purchases.list.viewPurchase')}>
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
          <h1 className="page-title">{t('pharmacy:purchases.list.title')}</h1>
          <p className="page-subtitle">{t('pharmacy:purchases.list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/pharmacy/purchases/new')}>
              <FiPlus aria-hidden="true" /> {t('pharmacy:purchases.list.newPurchase')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('pharmacy:purchases.list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('pharmacy:purchases.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default PharmacyPurchaseList;
