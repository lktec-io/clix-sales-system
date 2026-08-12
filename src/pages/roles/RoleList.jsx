import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import SettingsTabs from '../../components/common/SettingsTabs';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as roleService from '../../services/roleService';
import '../../styles/pages/Notifications.css';

// Permissions are fixed per system role (seeded server-side) rather than
// hand-edited through a UI — this page is role bookkeeping (name/description)
// only, not a permission-assignment tool.
function RoleList() {
  const { t } = useTranslation(['settings', 'common']);
  const canCreate = usePermission('roles.create');
  const canEdit = usePermission('roles.edit');
  const canDelete = usePermission('roles.delete');
  const toast = useToast();

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', description: '' } });

  const loadRoles = async () => {
    setLoading(true);
    try {
      const rows = await roleService.listRoles();
      setRoles(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRoles();
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    reset({ name: '', description: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    reset({ name: role.name, description: role.description || '' });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    try {
      if (editingRole) {
        await roleService.updateRole(editingRole.id, values);
        toast.success(t('settings:roles.updateSuccess'));
      } else {
        await roleService.createRole(values);
        toast.success(t('settings:roles.createSuccess'));
      }
      setModalOpen(false);
      loadRoles();
    } catch (err) {
      setError(err.response?.data?.message || t('settings:roles.saveError'));
    }
  };

  const handleDelete = async () => {
    await roleService.deleteRole(pendingDelete.id);
    toast.success(t('settings:roles.deleteSuccess'));
    loadRoles();
  };

  const columns = [
    { key: 'name', label: t('settings:roles.columns.name') },
    { key: 'description', label: t('settings:roles.columns.description'), render: (row) => row.description || '—' },
    {
      key: 'is_system',
      label: t('settings:roles.columns.type'),
      render: (row) => <span className={`badge ${row.is_system ? 'badge-info' : 'badge-neutral'}`}>{row.is_system ? t('settings:roles.systemBadge') : t('settings:roles.customBadge')}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          {canEdit && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label={t('settings:roles.editAria')}>
              <FiEdit2 />
            </button>
          )}
          {canDelete && !row.is_system && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPendingDelete(row)} aria-label={t('settings:roles.deleteAria')}>
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
          <h1 className="page-title">{t('settings:roles.pageTitle')}</h1>
          <p className="page-subtitle">{t('settings:roles.pageSubtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('settings:roles.newRole')}
            </button>
          </div>
        )}
      </div>

      <SettingsTabs />

      <div className="card">
        <Table columns={columns} rows={roles} loading={loading} emptyMessage={t('settings:roles.emptyMessage')} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRole ? t('settings:roles.editTitle') : t('settings:roles.newTitle')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="role-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting || editingRole?.is_system}>
              {editingRole ? t('common:actions.saveChanges') : t('settings:roles.createRole')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="role-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="name">{t('settings:roles.name')}</label>
            <input
              id="name"
              className={`form-control ${errors.name ? 'form-control-error' : ''}`}
              disabled={editingRole?.is_system}
              {...register('name', { required: t('settings:roles.nameRequired') })}
            />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
            {editingRole?.is_system && <span className="form-help">{t('settings:roles.systemNameHint')}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="description">{t('settings:roles.description')}</label>
            <textarea id="description" className="form-control" disabled={editingRole?.is_system} {...register('description')} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={t('settings:roles.deleteTitle')}
        message={pendingDelete ? t('settings:roles.deleteMessage', { name: pendingDelete.name }) : ''}
        confirmLabel={t('common:actions.delete')}
      />
    </div>
  );
}

export default RoleList;
