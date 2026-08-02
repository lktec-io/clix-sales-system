import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiTrash2, FiUserCheck, FiUserX } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ViewToggle from '../../components/common/ViewToggle';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import SettingsTabs from '../../components/common/SettingsTabs';
import * as userService from '../../services/userService';
import '../../styles/pages/Notifications.css';
import '../../styles/components/ViewToggle.css';

const STATUS_BADGE = {
  active: 'badge-success',
  suspended: 'badge-warning',
  locked: 'badge-danger',
};

function UserList() {
  const { t } = useTranslation(['settings', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('users.create');
  const canEdit = usePermission('users.edit');
  const canDelete = usePermission('users.delete');
  const toast = useToast();

  const [pendingDelete, setPendingDelete] = useState(null);
  const [actionError, setActionError] = useState('');
  const [view, setView] = useState('list');

  const fetchUsers = useCallback((params) => userService.listUsers(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, refetch } = useTable(fetchUsers);

  const statusLabel = (status) => t(`settings:users.statusLabels.${status}`);

  const handleToggleStatus = async (user) => {
    setActionError('');
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await userService.changeUserStatus(user.id, nextStatus);
      toast.success(nextStatus === 'active' ? t('settings:users.activateSuccess') : t('settings:users.suspendSuccess'));
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || t('settings:users.statusUpdateError'));
    }
  };

  const handleDelete = async () => {
    await userService.deleteUser(pendingDelete.id);
    toast.success(t('settings:users.deleteSuccess'));
    refetch();
  };

  const columns = [
    {
      key: 'name',
      label: t('settings:users.columns.name'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="navbar-user-avatar" style={{ width: 28, height: 28, fontSize: 'var(--font-size-xs)' }}>
            {row.first_name.charAt(0).toUpperCase()}
          </span>
          <span>{row.first_name} {row.last_name}</span>
        </div>
      ),
    },
    { key: 'username', label: t('settings:users.columns.username') },
    { key: 'email', label: t('common:labels.email') },
    { key: 'phone', label: t('common:labels.phone') },
    { key: 'role_name', label: t('settings:users.columns.role') },
    { key: 'branch_name', label: t('settings:users.columns.branch'), render: (row) => row.branch_name || '—' },
    {
      key: 'status',
      label: t('common:labels.status'),
      render: (row) => <span className={`badge ${STATUS_BADGE[row.status]}`}>{statusLabel(row.status)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          {canEdit && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/settings/users/${row.id}/edit`)} aria-label={t('settings:users.editAria')}>
              <FiEdit2 />
            </button>
          )}
          {canEdit && row.status !== 'locked' && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => handleToggleStatus(row)}
              aria-label={row.status === 'active' ? t('settings:users.suspendAria') : t('settings:users.activateAria')}
            >
              {row.status === 'active' ? <FiUserX /> : <FiUserCheck />}
            </button>
          )}
          {canDelete && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPendingDelete(row)} aria-label={t('settings:users.deleteAria')}>
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
          <h1 className="page-title">{t('settings:users.pageTitle')}</h1>
          <p className="page-subtitle">{t('settings:users.pageSubtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/settings/users/new')}>
              <FiPlus aria-hidden="true" /> {t('settings:users.newUser')}
            </button>
          </div>
        )}
      </div>

      <SettingsTabs />

      {actionError && (
        <div className="alert alert-danger mb-4" role="alert">
          {actionError}
        </div>
      )}

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('settings:users.searchPlaceholder')} />
          <ViewToggle view={view} onChange={setView} />
        </div>

        {view === 'list' ? (
          <Table columns={columns} rows={items} loading={loading} emptyMessage={t('settings:users.emptyMessage')} />
        ) : (
          <div className="management-grid">
            {items.map((row) => (
              <div className="card card-hover management-grid-card" key={row.id}>
                <div className="management-grid-card-header">
                  <span className="navbar-user-avatar" style={{ width: 44, height: 44, fontSize: 'var(--font-size-md)' }}>
                    {row.first_name.charAt(0).toUpperCase()}
                  </span>
                  <span className={`badge ${STATUS_BADGE[row.status]}`}>{statusLabel(row.status)}</span>
                </div>
                <div>
                  <div className="management-grid-card-title">{row.first_name} {row.last_name}</div>
                  <div className="management-grid-card-subtitle">{row.email}</div>
                </div>
                <div className="management-grid-card-body">
                  <span>{row.role_name}</span>
                  <span>{row.branch_name || t('settings:users.noBranchAssigned')}</span>
                </div>
                <div className="management-grid-card-footer">
                  <div className="table-actions">
                    {canEdit && (
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/settings/users/${row.id}/edit`)} aria-label={t('settings:users.editAria')}>
                        <FiEdit2 />
                      </button>
                    )}
                    {canEdit && row.status !== 'locked' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleToggleStatus(row)}
                        aria-label={row.status === 'active' ? t('settings:users.suspendAria') : t('settings:users.activateAria')}
                      >
                        {row.status === 'active' ? <FiUserX /> : <FiUserCheck />}
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPendingDelete(row)} aria-label={t('settings:users.deleteAria')}>
                        <FiTrash2 />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!loading && items.length === 0 && (
              <div className="text-sm text-secondary" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
                {t('settings:users.emptyMessage')}
              </div>
            )}
          </div>
        )}

        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={t('settings:users.deleteTitle')}
        message={pendingDelete ? t('settings:users.deleteMessage', { name: `${pendingDelete.first_name} ${pendingDelete.last_name}` }) : ''}
        confirmLabel={t('common:actions.delete')}
      />
    </div>
  );
}

export default UserList;
