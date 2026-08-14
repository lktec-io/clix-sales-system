import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import SettingsTabs from '../../components/common/SettingsTabs';
import { usePermission } from '../../hooks/usePermission';
import { useTable } from '../../hooks/useTable';
import { useToast } from '../../hooks/useToast';
import * as categoryService from '../../services/categoryService';
import '../../styles/pages/Notifications.css';

// Maps a category API error to the exact, product-approved copy the UI must
// show. `categories` is shared across every business template (products,
// medicines, menu items all reference it), so the backend's 409s are matched
// by substring rather than exact string equality — that way this mapping
// survives minor backend wording changes instead of silently falling through
// to the generic fallback.
function mapCategoryError(err, action, t) {
  const message = err?.response?.data?.message;
  if (typeof message === 'string') {
    const lower = message.toLowerCase();
    if (lower.includes('already exists')) return t('settings:categories.alreadyExists');
    if (lower.includes('currently being used')) return t('settings:categories.inUse');
  }
  return action === 'delete' ? t('settings:categories.deleteError') : t('settings:categories.saveError');
}

function CategorySettings() {
  const { t } = useTranslation(['settings', 'common']);
  const canCreate = usePermission('categories.create');
  const canEdit = usePermission('categories.edit');
  const canDelete = usePermission('categories.delete');
  const toast = useToast();

  const fetchCategories = useCallback((params) => categoryService.listCategories(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, refetch } = useTable(fetchCategories);

  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', code: '', description: '', status: 'active' } });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', code: '', description: '', status: 'active' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    reset({
      name: category.name,
      code: category.code,
      description: category.description || '',
      status: category.status || 'active',
    });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    const payload = {
      name: values.name,
      code: values.code,
      description: values.description?.trim() || undefined,
    };
    try {
      if (editing) {
        await categoryService.updateCategory(editing.id, { ...payload, status: values.status });
        toast.success(t('settings:categories.updateSuccess'));
      } else {
        await categoryService.createCategory(payload);
        toast.success(t('settings:categories.createSuccess'));
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setError(mapCategoryError(err, 'save', t));
    }
  };

  const closeDeleteDialog = () => {
    setPendingDelete(null);
    setDeleteError('');
  };

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await categoryService.deleteCategory(pendingDelete.id);
      toast.success(t('settings:categories.deleteSuccess'));
      refetch();
    } catch (err) {
      setDeleteError(mapCategoryError(err, 'delete', t));
      // Re-throw so ConfirmDialog keeps the dialog open instead of closing
      // silently — a category can legitimately fail to delete when it's
      // still in use by products, medicines, or menu items.
      throw err;
    }
  };

  const columns = [
    { key: 'name', label: t('settings:categories.columns.name') },
    { key: 'code', label: t('settings:categories.columns.code') },
    {
      key: 'actions',
      label: '',
      render: (row) => (canEdit || canDelete) && (
        <div className="table-actions">
          {canEdit && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label={t('settings:categories.editAria')}>
              <FiEdit2 />
            </button>
          )}
          {canDelete && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPendingDelete(row)} aria-label={t('settings:categories.deleteAria')}>
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
          <h1 className="page-title">{t('settings:categories.pageTitle')}</h1>
          <p className="page-subtitle">{t('settings:categories.pageSubtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('settings:categories.newCategory')}
            </button>
          </div>
        )}
      </div>

      <SettingsTabs />

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('settings:categories.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('settings:categories.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('settings:categories.editTitle') : t('settings:categories.newTitle')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="category-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {editing ? t('common:actions.saveChanges') : t('settings:categories.createCategory')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="category-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="name">{t('settings:categories.name')}</label>
            <input id="name" className={`form-control ${errors.name ? 'form-control-error' : ''}`} {...register('name', { required: t('settings:categories.nameRequired') })} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="code">{t('settings:categories.code')}</label>
            <input id="code" className={`form-control ${errors.code ? 'form-control-error' : ''}`} {...register('code', { required: t('settings:categories.codeRequired') })} />
            {errors.code && <span className="form-error">{errors.code.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="description">{t('settings:categories.description')}</label>
            <textarea id="description" className="form-control" rows={3} {...register('description')} />
          </div>
          {editing && (
            <div className="form-group mb-0">
              <label className="form-label" htmlFor="status">{t('settings:categories.status')}</label>
              <select id="status" className="form-control" {...register('status')}>
                <option value="active">{t('common:labels.active')}</option>
                <option value="inactive">{t('common:labels.inactive')}</option>
              </select>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={closeDeleteDialog}
        onConfirm={handleDelete}
        title={t('settings:categories.deleteTitle')}
        message={pendingDelete ? t('settings:categories.deleteMessage', { name: pendingDelete.name }) : ''}
        confirmLabel={t('common:actions.delete')}
        error={deleteError}
      />
    </div>
  );
}

export default CategorySettings;
