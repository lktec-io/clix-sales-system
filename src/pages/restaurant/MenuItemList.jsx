import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2 } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as menuItemService from '../../services/menuItemService';
import * as categoryService from '../../services/categoryService';
import { formatCurrency } from '../../utils/formatCurrency';

function MenuItemList() {
  const { t } = useTranslation(['restaurant', 'common']);
  const navigate = useNavigate();
  const canManage = usePermission('menu_items.manage');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    categoryService.listActiveCategories().then(setCategories);
  }, []);

  const fetchMenuItems = useCallback((params) => menuItemService.listMenuItems(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters } = useTable(fetchMenuItems);

  const columns = [
    { key: 'name', label: t('restaurant:menu.columns.name') },
    { key: 'category_name', label: t('restaurant:menu.columns.category'), render: (row) => row.category_name || '—' },
    { key: 'selling_price', label: t('restaurant:menu.columns.sellingPrice'), render: (row) => formatCurrency(row.selling_price) },
    {
      key: 'is_available',
      label: t('restaurant:menu.columns.status'),
      render: (row) => (
        <span className={`badge ${row.is_available ? 'badge-success' : 'badge-neutral'}`}>
          {t(row.is_available ? 'restaurant:menu.status.available' : 'restaurant:menu.status.unavailable')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        canManage && (
          <div className="table-actions">
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/menu/${row.id}/edit`)} aria-label={t('restaurant:menu.detail.edit')}>
              <FiEdit2 />
            </button>
          </div>
        )
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('restaurant:menu.list.title')}</h1>
          <p className="page-subtitle">{t('restaurant:menu.list.subtitle')}</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/menu/new')}>
              <FiPlus aria-hidden="true" /> {t('restaurant:menu.list.newItem')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('restaurant:menu.list.searchPlaceholder')} />
          <select
            className="form-control"
            value={filters.categoryId || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value || undefined }))}
          >
            <option value="">{t('restaurant:menu.list.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="form-control"
            value={filters.isAvailable === undefined ? '' : filters.isAvailable}
            onChange={(e) => setFilters((prev) => ({ ...prev, isAvailable: e.target.value || undefined }))}
          >
            <option value="">{t('restaurant:menu.list.allStatuses')}</option>
            <option value="true">{t('restaurant:menu.status.available')}</option>
            <option value="false">{t('restaurant:menu.status.unavailable')}</option>
          </select>
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('restaurant:menu.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default MenuItemList;
