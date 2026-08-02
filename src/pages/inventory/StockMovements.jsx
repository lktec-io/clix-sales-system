import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import { useTable } from '../../hooks/useTable';
import * as inventoryService from '../../services/inventoryService';
import * as branchService from '../../services/branchService';
import { formatNumber } from '../../utils/formatCurrency';

const MOVEMENT_TYPES = [
  'purchase', 'sale', 'return', 'transfer_out', 'transfer_in', 'adjustment', 'opening_balance', 'manual_correction',
];

const MOVEMENT_BADGE = {
  purchase: 'badge-success',
  sale: 'badge-info',
  return: 'badge-warning',
  transfer_out: 'badge-neutral',
  transfer_in: 'badge-neutral',
  adjustment: 'badge-warning',
  opening_balance: 'badge-neutral',
  manual_correction: 'badge-danger',
};

function StockMovements() {
  const { t, i18n } = useTranslation(['inventory', 'common']);
  const [branches, setBranches] = useState([]);

  const fetchMovements = useCallback((params) => inventoryService.listMovements(params), []);
  const { items, meta, loading, page, setPage, filters, setFilters } = useTable(fetchMovements);

  useEffect(() => {
    branchService.listActiveBranches().then(setBranches);
  }, []);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const columns = [
    { key: 'created_at', label: t('inventory:movementColumns.date'), render: (row) => formatDateTime(row.created_at) },
    { key: 'product_name', label: t('inventory:movementColumns.product'), render: (row) => <div>{row.product_name}<div className="text-xs text-secondary">{row.product_code}</div></div> },
    { key: 'branch_name', label: t('inventory:movementColumns.branch') },
    {
      key: 'movement_type',
      label: t('inventory:movementColumns.type'),
      render: (row) => <span className={`badge ${MOVEMENT_BADGE[row.movement_type] || 'badge-neutral'}`}>{t(`inventory:movementTypes.${row.movement_type}`, row.movement_type.replace('_', ' '))}</span>,
    },
    {
      key: 'quantity_change',
      label: t('inventory:movementColumns.change'),
      render: (row) => (
        <span className={row.quantity_change >= 0 ? 'text-success' : 'text-danger'}>
          {row.quantity_change >= 0 ? '+' : ''}{formatNumber(row.quantity_change)}
        </span>
      ),
    },
    { key: 'new_stock', label: t('inventory:movementColumns.resultingStock'), render: (row) => formatNumber(row.new_stock) },
    { key: 'user', label: t('inventory:movementColumns.by'), render: (row) => `${row.user_first_name} ${row.user_last_name}` },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/inventory" className="btn btn-ghost btn-sm mb-2">
            <FiArrowLeft aria-hidden="true" /> {t('inventory:movements.backToInventory')}
          </Link>
          <h1 className="page-title">{t('inventory:movements.title')}</h1>
          <p className="page-subtitle">{t('inventory:movements.subtitle')}</p>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="flex flex-wrap items-center gap-3">
            <select className="form-control" value={filters.branchId || ''} onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value || undefined }))}>
              <option value="">{t('common:labels.allBranches')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="form-control" value={filters.movementType || ''} onChange={(e) => setFilters((prev) => ({ ...prev, movementType: e.target.value || undefined }))}>
              <option value="">{t('inventory:movements.allMovementTypes')}</option>
              {MOVEMENT_TYPES.map((mt) => <option key={mt} value={mt}>{t(`inventory:movementTypes.${mt}`)}</option>)}
            </select>
          </div>
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('inventory:movements.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default StockMovements;
