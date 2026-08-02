import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiEye, FiToggleLeft, FiToggleRight, FiTruck, FiTrash2 } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ViewToggle from '../../components/common/ViewToggle';
import SupplierFormFields from '../../components/forms/SupplierFormFields';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as supplierService from '../../services/supplierService';
import '../../styles/components/ViewToggle.css';

const DEFAULT_VALUES = { name: '', phone: '', email: '', address: '', notes: '' };

function SupplierList() {
  const { t } = useTranslation(['suppliers', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('suppliers.create');
  const canEdit = usePermission('suppliers.edit');
  const canDelete = usePermission('suppliers.delete');
  const toast = useToast();

  const fetchSuppliers = useCallback((params) => supplierService.listSuppliers(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, refetch } = useTable(fetchSuppliers);

  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState('list');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: DEFAULT_VALUES });

  const openCreate = () => {
    setEditing(null);
    reset(DEFAULT_VALUES);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    reset({
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    try {
      if (editing) {
        await supplierService.updateSupplier(editing.id, values);
        toast.success(t('suppliers:list.updateSuccess'));
      } else {
        await supplierService.createSupplier(values);
        toast.success(t('suppliers:list.createSuccess'));
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || t('suppliers:list.saveError'));
    }
  };

  const handleToggleStatus = async (supplier) => {
    setActionError('');
    const nextStatus = supplier.status === 'active' ? 'inactive' : 'active';
    try {
      await supplierService.changeSupplierStatus(supplier.id, nextStatus);
      toast.success(nextStatus === 'active' ? t('suppliers:list.activateSuccess') : t('suppliers:list.deactivateSuccess'));
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || t('suppliers:list.statusUpdateError'));
    }
  };

  const handleDelete = async () => {
    try {
      await supplierService.deleteSupplier(pendingDelete.id);
      toast.success(t('suppliers:list.deleteSuccess'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || t('suppliers:list.deleteError'));
    }
  };

  const columns = [
    { key: 'name', label: t('suppliers:columns.supplierName') },
    { key: 'phone', label: t('suppliers:columns.phone'), render: (row) => row.phone || '—' },
    { key: 'email', label: t('suppliers:columns.email'), render: (row) => row.email || '—' },
    {
      key: 'status',
      label: t('suppliers:columns.status'),
      render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{row.status === 'active' ? t('common:labels.active') : t('common:labels.inactive')}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/suppliers/${row.id}`)} aria-label={t('suppliers:list.viewSupplier')}>
            <FiEye />
          </button>
          {canEdit && (
            <>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label={t('suppliers:list.editSupplier')}>
                <FiEdit2 />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => handleToggleStatus(row)}
                aria-label={row.status === 'active' ? t('suppliers:list.deactivateSupplier') : t('suppliers:list.activateSupplier')}
              >
                {row.status === 'active' ? <FiToggleRight /> : <FiToggleLeft />}
              </button>
            </>
          )}
          {canDelete && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPendingDelete(row)} aria-label={t('suppliers:list.deleteSupplier')}>
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
          <h1 className="page-title">{t('suppliers:list.title')}</h1>
          <p className="page-subtitle">{t('suppliers:list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('suppliers:list.newSupplier')}
            </button>
          </div>
        )}
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('suppliers:list.searchPlaceholder')} />
          <ViewToggle view={view} onChange={setView} />
        </div>

        {view === 'list' ? (
          <Table columns={columns} rows={items} loading={loading} emptyMessage={t('suppliers:list.emptyMessage')} />
        ) : (
          <div className="management-grid">
            {items.map((row) => (
              <div className="card card-hover management-grid-card" key={row.id}>
                <div className="management-grid-card-header">
                  <div className="management-grid-card-media">
                    <FiTruck aria-hidden="true" />
                  </div>
                  <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{row.status === 'active' ? t('common:labels.active') : t('common:labels.inactive')}</span>
                </div>
                <div>
                  <div className="management-grid-card-title">{row.name}</div>
                  <div className="management-grid-card-subtitle">{row.email || row.phone || '—'}</div>
                </div>
                <div className="management-grid-card-body">
                  <span>{row.phone || '—'}</span>
                  <span>{row.tin_number ? t('suppliers:list.tinLabel', { tin: row.tin_number }) : ''}</span>
                </div>
                <div className="management-grid-card-footer">
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/suppliers/${row.id}`)} aria-label={t('suppliers:list.viewSupplier')}>
                    <FiEye />
                  </button>
                  {canEdit && (
                    <div className="table-actions">
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label={t('suppliers:list.editSupplier')}>
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleToggleStatus(row)}
                        aria-label={row.status === 'active' ? t('suppliers:list.deactivateSupplier') : t('suppliers:list.activateSupplier')}
                      >
                        {row.status === 'active' ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                    </div>
                  )}
                  {canDelete && (
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPendingDelete(row)} aria-label={t('suppliers:list.deleteSupplier')}>
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!loading && items.length === 0 && (
              <div className="text-sm text-secondary" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
                {t('suppliers:list.emptyMessage')}
              </div>
            )}
          </div>
        )}

        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('suppliers:list.editModalTitle') : t('suppliers:list.newModalTitle')}
        size="md"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="supplier-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {editing ? t('suppliers:list.saveChanges') : t('suppliers:list.createSupplier')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <SupplierFormFields register={register} errors={errors} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={t('suppliers:list.deleteDialogTitle')}
        message={t('suppliers:list.deleteDialogMessage')}
        confirmLabel={t('suppliers:list.deleteConfirmLabel')}
      />
    </div>
  );
}

export default SupplierList;
