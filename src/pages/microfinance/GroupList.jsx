import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiUsers, FiTrash2 } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as loanGroupService from '../../services/loanGroupService';
import * as customerService from '../../services/customerService';

function GroupList() {
  const { t } = useTranslation(['microfinance', 'common']);
  const canManage = usePermission('borrower_groups.manage');
  const toast = useToast();
  const [customers, setCustomers] = useState([]);

  const fetchGroups = useCallback((params) => loanGroupService.listGroups(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, refetch } = useTable(fetchGroups);

  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [membersGroup, setMembersGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [newMemberId, setNewMemberId] = useState('');
  const [error, setError] = useState('');
  const [membersError, setMembersError] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: { name: '', leaderCustomerId: '', status: 'active' } });

  useEffect(() => {
    customerService.listActiveCustomers().then(setCustomers);
  }, []);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', leaderCustomerId: '', status: 'active' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (group) => {
    setEditing(group);
    reset({ name: group.name, leaderCustomerId: group.leader_customer_id || '', status: group.status });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    const payload = { name: values.name, leaderCustomerId: values.leaderCustomerId ? Number(values.leaderCustomerId) : undefined, status: values.status };
    try {
      if (editing) {
        await loanGroupService.updateGroup(editing.id, payload);
        toast.success(t('microfinance:groups.list.updateSuccess'));
      } else {
        await loanGroupService.createGroup(payload);
        toast.success(t('microfinance:groups.list.createSuccess'));
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || t('microfinance:groups.list.saveError'));
    }
  };

  const openMembers = async (group) => {
    setMembersError('');
    setNewMemberId('');
    const detail = await loanGroupService.getGroup(group.id);
    setMembersGroup(detail);
    setMembers(detail.members);
  };

  const handleAddMember = async () => {
    if (!newMemberId) return;
    setMembersError('');
    try {
      const updated = await loanGroupService.addMember(membersGroup.id, Number(newMemberId));
      setMembers(updated);
      setNewMemberId('');
      toast.success(t('microfinance:groups.members.addSuccess'));
    } catch (err) {
      setMembersError(err.response?.data?.message || t('microfinance:groups.members.addError'));
    }
  };

  const handleRemoveMember = async (customerId) => {
    setMembersError('');
    try {
      const updated = await loanGroupService.removeMember(membersGroup.id, customerId);
      setMembers(updated);
      toast.success(t('microfinance:groups.members.removeSuccess'));
    } catch (err) {
      setMembersError(err.response?.data?.message || t('microfinance:groups.members.removeError'));
    }
  };

  const columns = [
    { key: 'name', label: t('common:labels.name') },
    { key: 'leader', label: t('microfinance:groups.list.leaderLabel'), render: (row) => (row.leader_first_name ? `${row.leader_first_name} ${row.leader_last_name}` : '—') },
    { key: 'member_count', label: t('microfinance:groups.list.membersColumn'), render: (row) => row.member_count },
    {
      key: 'status',
      label: t('common:labels.status'),
      render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{row.status}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => openMembers(row)} aria-label={t('microfinance:groups.list.manageMembers')}>
            <FiUsers />
          </button>
          {canManage && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label={t('microfinance:loanProducts.list.editProduct')}>
              <FiEdit2 />
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
          <h1 className="page-title">{t('microfinance:groups.list.title')}</h1>
          <p className="page-subtitle">{t('microfinance:groups.list.subtitle')}</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('microfinance:groups.list.newGroup')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('microfinance:groups.list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('microfinance:groups.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('microfinance:groups.list.editModalTitle') : t('microfinance:groups.list.newModalTitle')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="group-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {t('microfinance:groups.list.save')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="group-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="name">{t('microfinance:groups.list.nameLabel')}</label>
            <input id="name" className={`form-control ${errors.name ? 'form-control-error' : ''}`} {...register('name', { required: t('microfinance:groups.list.nameRequired') })} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="leaderCustomerId">{t('microfinance:groups.list.leaderLabel')}</label>
            <select id="leaderCustomerId" className="form-control" {...register('leaderCustomerId')}>
              <option value="">{t('microfinance:groups.list.selectLeader')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          {editing && (
            <div className="form-group">
              <label className="form-label" htmlFor="status">{t('microfinance:groups.list.statusLabel')}</label>
              <select id="status" className="form-control" {...register('status')}>
                <option value="active">{t('microfinance:groups.list.active')}</option>
                <option value="inactive">{t('microfinance:groups.list.inactive')}</option>
              </select>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(membersGroup)}
        onClose={() => setMembersGroup(null)}
        title={membersGroup ? t('microfinance:groups.members.title', { group: membersGroup.name }) : ''}
        size="sm"
      >
        {membersError && <div className="alert alert-danger mb-4" role="alert">{membersError}</div>}
        {canManage && (
          <div className="form-row mb-4" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="newMemberId">{t('microfinance:groups.members.customerLabel')}</label>
              <select id="newMemberId" className="form-control" value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)}>
                <option value="">{t('microfinance:groups.members.selectCustomer')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleAddMember}>{t('microfinance:groups.members.add')}</button>
          </div>
        )}
        {members.length === 0 ? (
          <EmptyState title={t('microfinance:groups.members.noMembers')} />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm">{m.first_name} {m.last_name} <span className="text-xs text-secondary">{m.phone}</span></span>
                {canManage && (
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => handleRemoveMember(m.customer_id)} aria-label={t('microfinance:groups.members.remove')}>
                    <FiTrash2 />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

export default GroupList;
