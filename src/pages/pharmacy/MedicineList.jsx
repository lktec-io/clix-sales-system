import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye, FiUpload } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import MedicineImportModal from './MedicineImportModal';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as medicineService from '../../services/medicineService';
import * as categoryService from '../../services/categoryService';
import { formatCurrency } from '../../utils/formatCurrency';

// A medicine's stock state is derived live from its current_stock/
// reorder_level (see medicine.repository.js's LIST_SELECT) — never a stored
// flag — so this badge always agrees with what the Dashboard/Expiry pages
// compute from the same numbers.
function stockBadge(row, t) {
  const stock = Number(row.current_stock);
  if (stock <= 0) return <span className="badge badge-danger">{t('pharmacy:medicines.stockStatus.outOfStock')}</span>;
  if (stock <= Number(row.reorder_level)) return <span className="badge badge-warning">{t('pharmacy:medicines.stockStatus.lowStock')}</span>;
  return <span className="badge badge-success">{t('pharmacy:medicines.stockStatus.inStock')}</span>;
}

function MedicineList() {
  const { t } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('medicines.manage');
  const [categories, setCategories] = useState([]);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    categoryService.listActiveCategories().then(setCategories);
  }, []);

  const fetchMedicines = useCallback((params) => medicineService.listMedicines(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters, refetch } = useTable(fetchMedicines);

  const columns = [
    { key: 'name', label: t('pharmacy:medicines.columns.name') },
    { key: 'category_name', label: t('pharmacy:medicines.columns.category'), render: (row) => row.category_name || '—' },
    { key: 'unit', label: t('pharmacy:medicines.columns.unit') },
    { key: 'selling_price', label: t('pharmacy:medicines.columns.sellingPrice'), render: (row) => formatCurrency(row.selling_price) },
    { key: 'current_stock', label: t('pharmacy:medicines.columns.stock'), render: (row) => `${row.current_stock} ${row.unit}` },
    { key: 'status', label: t('pharmacy:medicines.columns.status'), render: (row) => stockBadge(row, t) },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/medicines/${row.id}`)} aria-label={t('pharmacy:medicines.list.viewMedicine')}>
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
          <h1 className="page-title">{t('pharmacy:medicines.list.title')}</h1>
          <p className="page-subtitle">{t('pharmacy:medicines.list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>
              <FiUpload aria-hidden="true" /> {t('pharmacy:import.title')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/medicines/new')}>
              <FiPlus aria-hidden="true" /> {t('pharmacy:medicines.list.newMedicine')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('pharmacy:medicines.list.searchPlaceholder')} />
          <select
            className="form-control"
            value={filters.categoryId || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value || undefined }))}
          >
            <option value="">{t('pharmacy:medicines.list.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="form-control"
            value={filters.status || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value || undefined }))}
          >
            <option value="">{t('pharmacy:medicines.list.allStatuses')}</option>
            <option value="active">{t('pharmacy:medicines.status.active')}</option>
            <option value="inactive">{t('pharmacy:medicines.status.inactive')}</option>
          </select>
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('pharmacy:medicines.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <MedicineImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refetch} />
    </div>
  );
}

export default MedicineList;
