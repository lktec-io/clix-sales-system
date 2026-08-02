import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiEdit3, FiClock, FiBox, FiDollarSign, FiAlertTriangle, FiXCircle } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import KPICard from '../../components/dashboard/KPICard';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as inventoryService from '../../services/inventoryService';
import * as branchService from '../../services/branchService';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';

const REASONS = ['damaged', 'expired', 'lost', 'correction', 'initial_count', 'system_error'];

function InventoryOverview() {
  const { t } = useTranslation(['inventory', 'common']);
  const canAdjust = usePermission('inventory.adjust');
  const toast = useToast();

  const [branches, setBranches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [adjustingRow, setAdjustingRow] = useState(null);
  const [modalError, setModalError] = useState('');

  const fetchInventory = useCallback((params) => inventoryService.listInventory(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters, refetch } = useTable(fetchInventory);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { quantityChange: '', reason: 'correction', description: '' } });

  useEffect(() => {
    branchService.listActiveBranches().then(setBranches);
    inventoryService.getInventorySummary().then(setSummary);
  }, []);

  const openAdjust = (row) => {
    setAdjustingRow(row);
    reset({ quantityChange: '', reason: 'correction', description: '' });
    setModalError('');
  };

  const onSubmitAdjustment = async (values) => {
    setModalError('');
    try {
      await inventoryService.createAdjustment({
        productId: adjustingRow.product_id,
        branchId: adjustingRow.branch_id,
        quantityChange: Number(values.quantityChange),
        reason: values.reason,
        description: values.description,
      });
      setAdjustingRow(null);
      toast.success(t('inventory:overview.adjustmentSuccess'));
      refetch();
      inventoryService.getInventorySummary().then(setSummary);
    } catch (err) {
      setModalError(err.response?.data?.message || t('inventory:overview.adjustmentError'));
    }
  };

  const columns = [
    { key: 'product_name', label: t('inventory:columns.product'), render: (row) => <div>{row.product_name}<div className="text-xs text-secondary">{row.product_code}</div></div> },
    { key: 'branch_name', label: t('inventory:columns.branch') },
    { key: 'quantity', label: t('inventory:columns.currentStock'), render: (row) => formatNumber(row.quantity) },
    { key: 'available_quantity', label: t('inventory:columns.available'), render: (row) => formatNumber(row.available_quantity) },
    { key: 'min_stock', label: t('inventory:columns.minStock'), render: (row) => formatNumber(row.min_stock) },
    { key: 'stock_value', label: t('inventory:columns.stockValue'), render: (row) => formatCurrency(row.stock_value) },
    {
      key: 'level',
      label: t('inventory:columns.level'),
      render: (row) => {
        if (row.quantity === 0) return <span className="badge badge-danger">{t('inventory:overview.outOfStock')}</span>;
        if (row.quantity <= row.min_stock) return <span className="badge badge-warning">{t('inventory:overview.lowStock')}</span>;
        return <span className="badge badge-success">{t('inventory:overview.inStock')}</span>;
      },
    },
    {
      key: 'actions',
      label: '',
      render: (row) => canAdjust && (
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => openAdjust(row)} aria-label={t('inventory:overview.adjustStock')}>
          <FiEdit3 />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('inventory:overview.title')}</h1>
          <p className="page-subtitle">{t('inventory:overview.subtitle')}</p>
        </div>
        <div className="page-actions">
          <Link to="/inventory/movements" className="btn btn-secondary">
            <FiClock aria-hidden="true" /> {t('inventory:overview.movementHistory')}
          </Link>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-4 mb-5">
          <KPICard icon={FiBox} label={t('inventory:kpi.totalProducts')} value={summary.totalProducts} formatter={formatNumber} />
          <KPICard icon={FiDollarSign} label={t('inventory:kpi.inventoryValue')} value={summary.totalValue} formatter={(v) => formatCurrency(v)} />
          <KPICard icon={FiAlertTriangle} label={t('inventory:kpi.lowStock')} value={summary.lowStock} formatter={formatNumber} />
          <KPICard icon={FiXCircle} label={t('inventory:kpi.outOfStock')} value={summary.outOfStock} formatter={formatNumber} />
        </div>
      )}

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('inventory:overview.searchPlaceholder')} />
          <div className="flex flex-wrap items-center gap-3">
            <select className="form-control" value={filters.branchId || ''} onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value || undefined }))}>
              <option value="">{t('common:labels.allBranches')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label className="form-checkbox">
              <input type="checkbox" checked={Boolean(filters.lowStock)} onChange={(e) => setFilters((prev) => ({ ...prev, lowStock: e.target.checked || undefined }))} />
              {t('inventory:overview.lowStock')}
            </label>
            <label className="form-checkbox">
              <input type="checkbox" checked={Boolean(filters.outOfStock)} onChange={(e) => setFilters((prev) => ({ ...prev, outOfStock: e.target.checked || undefined }))} />
              {t('inventory:overview.outOfStock')}
            </label>
          </div>
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('inventory:overview.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <Modal
        open={Boolean(adjustingRow)}
        onClose={() => setAdjustingRow(null)}
        title={t('inventory:modal.title')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAdjustingRow(null)}>{t('inventory:modal.cancel')}</button>
            <button type="submit" form="adjustment-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {t('inventory:modal.saveAdjustment')}
            </button>
          </>
        }
      >
        {adjustingRow && (
          <>
            <p className="text-sm mb-4">
              <strong>{adjustingRow.product_name}</strong>{' '}
              {t('inventory:modal.atBranch', { branch: adjustingRow.branch_name })} —{' '}
              {t('inventory:modal.currentStock', { stock: formatNumber(adjustingRow.quantity) })}
            </p>
            {modalError && <div className="alert alert-danger mb-4" role="alert">{modalError}</div>}
            <form id="adjustment-form" onSubmit={handleSubmit(onSubmitAdjustment)} noValidate>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="quantityChange">
                  {t('inventory:modal.quantityChangeLabel')}
                </label>
                <input
                  id="quantityChange"
                  type="number"
                  className={`form-control ${errors.quantityChange ? 'form-control-error' : ''}`}
                  {...register('quantityChange', { required: t('inventory:modal.quantityRequired'), validate: (v) => Number(v) !== 0 || t('inventory:modal.cannotBeZero') })}
                />
                {errors.quantityChange && <span className="form-error">{errors.quantityChange.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="reason">{t('inventory:modal.reason')}</label>
                <select id="reason" className="form-control" {...register('reason')}>
                  {REASONS.map((r) => <option key={r} value={r}>{t(`inventory:reasons.${r}`)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="description">{t('inventory:modal.description')}</label>
                <textarea id="description" className="form-control" {...register('description')} />
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}

export default InventoryOverview;
