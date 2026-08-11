import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiPower } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as restaurantTableService from '../../services/restaurantTableService';
import * as branchService from '../../services/branchService';

const STATUS_BADGE = { available: 'badge-success', occupied: 'badge-danger', reserved: 'badge-warning' };

function TableList() {
  const { t } = useTranslation(['restaurant', 'common']);
  const canManage = usePermission('restaurant_tables.manage');
  const toast = useToast();

  const [branches, setBranches] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { branchId: '', tableNumber: '', capacity: 4 } });

  const loadTables = useCallback(() => {
    setLoading(true);
    restaurantTableService.listTables({ branchId: branchFilter || undefined, status: statusFilter || undefined })
      .then(setTables)
      .finally(() => setLoading(false));
  }, [branchFilter, statusFilter]);

  useEffect(() => {
    branchService.listActiveBranches().then((rows) => {
      setBranches(rows);
      if (rows.length === 1) setValue('branchId', rows[0].id);
    });
  }, [setValue]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the table list on filter change is standard data-fetching, not derived state
    loadTables();
  }, [loadTables]);

  const openCreate = () => {
    setEditing(null);
    reset({ branchId: branches.length === 1 ? branches[0].id : '', tableNumber: '', capacity: 4 });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (table) => {
    setEditing(table);
    reset({ branchId: table.branch_id, tableNumber: table.table_number, capacity: table.capacity });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    const payload = { branchId: Number(values.branchId), tableNumber: values.tableNumber.trim(), capacity: Number(values.capacity) };
    try {
      if (editing) {
        await restaurantTableService.updateTable(editing.id, payload);
        toast.success(t('restaurant:tables.form.updateSuccess'));
      } else {
        await restaurantTableService.createTable(payload);
        toast.success(t('restaurant:tables.form.createSuccess'));
      }
      setModalOpen(false);
      loadTables();
    } catch (err) {
      setError(err.response?.data?.message || t('restaurant:tables.form.saveError'));
    }
  };

  const toggleReserved = async (table) => {
    setActionError('');
    try {
      await restaurantTableService.setTableStatus(table.id, table.status === 'reserved' ? 'available' : 'reserved');
      toast.success(t('restaurant:tables.actions.statusUpdateSuccess'));
      loadTables();
    } catch (err) {
      setActionError(err.response?.data?.message || t('restaurant:tables.actions.statusUpdateError'));
    }
  };

  const toggleActive = async (table) => {
    setActionError('');
    try {
      await restaurantTableService.setTableActive(table.id, !table.is_active);
      toast.success(t('restaurant:tables.actions.statusUpdateSuccess'));
      loadTables();
    } catch (err) {
      setActionError(err.response?.data?.message || t('restaurant:tables.actions.statusUpdateError'));
    }
  };

  const columns = [
    { key: 'table_number', label: t('restaurant:tables.columns.tableNumber') },
    { key: 'branch_name', label: t('restaurant:tables.columns.branch') },
    { key: 'capacity', label: t('restaurant:tables.columns.capacity') },
    {
      key: 'status',
      label: t('restaurant:tables.columns.status'),
      render: (row) => <span className={`badge ${STATUS_BADGE[row.status] || 'badge-neutral'}`}>{t(`restaurant:tables.status.${row.status}`)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        canManage && (
          <div className="table-actions">
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label={t('common:actions.edit')}>
              <FiEdit2 />
            </button>
            {row.status !== 'occupied' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleReserved(row)}>
                {t(row.status === 'reserved' ? 'restaurant:tables.actions.markAvailable' : 'restaurant:tables.actions.markReserved')}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => toggleActive(row)} aria-label={t(row.is_active ? 'restaurant:tables.actions.deactivate' : 'restaurant:tables.actions.activate')}>
              <FiPower />
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
          <h1 className="page-title">{t('restaurant:tables.list.title')}</h1>
          <p className="page-subtitle">{t('restaurant:tables.list.subtitle')}</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('restaurant:tables.list.newTable')}
            </button>
          </div>
        )}
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <div className="table-toolbar">
          {branches.length > 1 && (
            <select className="form-control" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">{t('restaurant:tables.list.allBranches')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('restaurant:tables.list.allStatuses')}</option>
            <option value="available">{t('restaurant:tables.status.available')}</option>
            <option value="occupied">{t('restaurant:tables.status.occupied')}</option>
            <option value="reserved">{t('restaurant:tables.status.reserved')}</option>
          </select>
        </div>
        <Table columns={columns} rows={tables} loading={loading} emptyMessage={t('restaurant:tables.list.emptyMessage')} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t(editing ? 'restaurant:tables.form.editTitle' : 'restaurant:tables.form.newTitle')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="table-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {t('restaurant:tables.form.save')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="table-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {branches.length > 1 && (
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="branchId">{t('restaurant:tables.form.branchLabel')}</label>
              <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: t('restaurant:tables.form.branchRequired') })}>
                <option value="">{t('restaurant:tables.form.selectBranch')}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {errors.branchId && <span className="form-error">{errors.branchId.message}</span>}
            </div>
          )}
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="tableNumber">{t('restaurant:tables.form.tableNumberLabel')}</label>
            <input id="tableNumber" className={`form-control ${errors.tableNumber ? 'form-control-error' : ''}`} {...register('tableNumber', { required: t('restaurant:tables.form.tableNumberRequired') })} />
            {errors.tableNumber && <span className="form-error">{errors.tableNumber.message}</span>}
          </div>
          <div className="form-group mb-0">
            <label className="form-label" htmlFor="capacity">{t('restaurant:tables.form.capacityLabel')}</label>
            <input id="capacity" type="number" min="1" step="1" className="form-control" {...register('capacity')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TableList;
