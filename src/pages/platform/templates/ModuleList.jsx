import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiPlus, FiEdit2, FiCheckCircle, FiSlash } from 'react-icons/fi';
import Table from '../../../components/common/Table';
import Modal from '../../../components/common/Modal';
import * as platformModuleService from '../../../services/platformModuleService';

const DEFAULT_VALUES = { key: '', name: '', icon: '', route: '', requiredPermission: '', navigationOrder: 0 };

function ModuleList() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingModule, setEditingModule] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: DEFAULT_VALUES });

  const loadModules = async () => {
    setLoading(true);
    try {
      const rows = await platformModuleService.listModules();
      setModules(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadModules();
  }, []);

  const openCreate = () => {
    setEditingModule(null);
    reset(DEFAULT_VALUES);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (module) => {
    setEditingModule(module);
    reset({
      key: module.key, name: module.name, icon: module.icon || '', route: module.route || '',
      requiredPermission: module.required_permission || '', navigationOrder: module.navigation_order,
    });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    const payload = { ...values, navigationOrder: Number(values.navigationOrder) || 0 };
    try {
      if (editingModule) await platformModuleService.updateModule(editingModule.id, payload);
      else await platformModuleService.createModule(payload);
      setModalOpen(false);
      loadModules();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save module.');
    }
  };

  const runAction = async (fn) => {
    setActionError('');
    try {
      await fn();
      loadModules();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <span className="flex items-center gap-2">
        {row.name}
        {row.is_core ? <span className="badge badge-info">Core</span> : null}
      </span>
    ) },
    { key: 'key', label: 'Key', render: (row) => <code>{row.key}</code> },
    { key: 'route', label: 'Route', render: (row) => row.route || '—' },
    { key: 'required_permission', label: 'Permission', render: (row) => row.required_permission || '—' },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`badge ${row.is_active ? 'badge-success' : 'badge-neutral'}`}>{row.is_active ? 'Active' : 'Inactive'}</span>
    ) },
    { key: 'actions', label: '', render: (row) => (
      <div className="table-actions">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label="Edit"><FiEdit2 /></button>
        {row.is_active ? (
          <button
            type="button" className="btn btn-ghost btn-icon" disabled={row.is_core}
            title={row.is_core ? 'Core modules cannot be deactivated' : undefined}
            onClick={() => runAction(() => platformModuleService.deactivateModule(row.id))} aria-label="Deactivate"
          >
            <FiSlash />
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => runAction(() => platformModuleService.activateModule(row.id))} aria-label="Activate"><FiCheckCircle /></button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Module Registry</h1>
          <p className="page-subtitle">The full set of modules Business Templates can enable — core modules are always available and can't be deactivated.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <FiPlus aria-hidden="true" /> New Module
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <Table columns={columns} rows={modules} loading={loading} emptyMessage="No modules yet." />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingModule ? 'Edit Module' : 'New Module'}
        size="md"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="module-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {editingModule ? 'Save Changes' : 'Create Module'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="module-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="key">Key</label>
            <input
              id="key" className={`form-control ${errors.key ? 'form-control-error' : ''}`} disabled={Boolean(editingModule)}
              {...register('key', { required: 'Key is required' })}
            />
            {errors.key && <span className="form-error">{errors.key.message}</span>}
            <span className="form-help">Lowercase, hyphen-separated, e.g. "loyalty-points". Cannot be changed after creation.</span>
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="name">Name</label>
            <input id="name" className={`form-control ${errors.name ? 'form-control-error' : ''}`} {...register('name', { required: 'Name is required' })} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="icon">Icon</label>
              <input id="icon" className="form-control" placeholder="FiBox" {...register('icon')} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="navigationOrder">Navigation Order</label>
              <input id="navigationOrder" type="number" className="form-control" {...register('navigationOrder')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="route">Route</label>
            <input id="route" className="form-control" placeholder="/example" {...register('route')} />
            <span className="form-help">Leave blank for a module with no dedicated top-level page.</span>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="requiredPermission">Required Permission</label>
            <input id="requiredPermission" className="form-control" placeholder="example.view" {...register('requiredPermission')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ModuleList;
