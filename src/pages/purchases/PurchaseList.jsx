import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye, FiUpload, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import PurchaseImportModal from './PurchaseImportModal';
import TypedConfirmDialog from '../../components/common/TypedConfirmDialog';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as purchaseService from '../../services/purchaseService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = { received: 'badge-success', pending: 'badge-warning', cancelled: 'badge-danger' };

function PurchaseList() {
  const { t, i18n } = useTranslation(['purchases', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const canCreate = usePermission('purchases.create');
  const canDelete = usePermission('purchases.delete');
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  const fetchPurchases = useCallback((params) => purchaseService.listPurchases(params), []);
  const { items, meta, loading, error, page, setPage, search, setSearch, refetch } = useTable(fetchPurchases);

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await purchaseService.deletePurchase(pendingDelete.id);
      toast.success(t('purchases:list.deleteSuccess'));
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || t('purchases:list.deleteError'));
      throw err;
    }
  };

  const columns = [
    { key: 'purchase_number', label: t('purchases:columns.purchaseNumber') },
    { key: 'supplier_name', label: t('purchases:columns.supplier') },
    { key: 'branch_name', label: t('purchases:columns.branch') },
    { key: 'total_amount', label: t('purchases:columns.amount'), render: (row) => formatCurrency(row.total_amount) },
    { key: 'created_at', label: t('purchases:columns.date'), render: (row) => formatDate(row.created_at) },
    {
      key: 'status',
      label: t('purchases:columns.status'),
      render: (row) => (
        <span className={`badge ${STATUS_BADGE[row.status] || 'badge-neutral'}`}>
          {t(`purchases:statusOptions.${row.status}`, row.status)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/purchases/${row.id}`)} aria-label={t('purchases:list.viewPurchase')}>
            <FiEye />
          </button>
          {canDelete && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => { setDeleteError(''); setPendingDelete(row); }}
              aria-label={t('purchases:list.deletePurchase')}
            >
              <FiTrash2 />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('purchases:list.title')}</h1>
          <p className="page-subtitle">{t('purchases:list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>
              <FiUpload aria-hidden="true" /> {t('purchases:list.importExcel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/purchases/new')}>
              <FiPlus aria-hidden="true" /> {t('purchases:list.newPurchase')}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-danger mb-4 flex items-center justify-between" role="alert">
          <span>{t('purchases:list.loadError')}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={refetch}>
            <FiRefreshCw aria-hidden="true" /> {t('common:actions.retry')}
          </button>
        </div>
      )}

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('purchases:list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('purchases:list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <PurchaseImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refetch} />

      <TypedConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={t('purchases:list.deleteDialogTitle')}
        message={pendingDelete ? t('purchases:list.deleteDialogMessage', { number: pendingDelete.purchase_number }) : ''}
        confirmLabel={t('purchases:list.deletePermanently')}
        error={deleteError}
      />
    </div>
  );
}

export default PurchaseList;
