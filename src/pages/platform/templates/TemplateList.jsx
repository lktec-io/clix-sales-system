import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiPlus, FiEdit2, FiCopy, FiCheckCircle, FiSlash, FiArchive, FiGrid } from 'react-icons/fi';
import Table from '../../../components/common/Table';
import Modal from '../../../components/common/Modal';
import * as platformBusinessTemplateService from '../../../services/platformBusinessTemplateService';

const DEFAULT_VALUES = { name: '', slug: '', description: '' };
const DUPLICATE_DEFAULTS = { name: '', slug: '' };

const STATUS_BADGE = { active: 'badge-success', inactive: 'badge-warning', archived: 'badge-neutral' };

function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [duplicatingTemplate, setDuplicatingTemplate] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const [modulesTemplate, setModulesTemplate] = useState(null);
  const [moduleRows, setModuleRows] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState('');
  const [modulesSaving, setModulesSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: DEFAULT_VALUES });

  const {
    register: registerDuplicate,
    handleSubmit: handleSubmitDuplicate,
    reset: resetDuplicate,
    formState: { errors: duplicateErrors, isSubmitting: duplicateSubmitting },
  } = useForm({ defaultValues: DUPLICATE_DEFAULTS });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const rows = await platformBusinessTemplateService.listTemplates();
      setTemplates(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTemplates();
  }, []);

  const openCreate = () => {
    setEditingTemplate(null);
    reset(DEFAULT_VALUES);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    reset({ name: template.name, slug: template.slug, description: template.description || '' });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    try {
      if (editingTemplate) await platformBusinessTemplateService.updateTemplate(editingTemplate.id, values);
      else await platformBusinessTemplateService.createTemplate(values);
      setModalOpen(false);
      loadTemplates();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save template.');
    }
  };

  const openDuplicate = (template) => {
    setDuplicatingTemplate(template);
    resetDuplicate({ name: `${template.name} Copy`, slug: `${template.slug}-copy` });
  };

  const onSubmitDuplicate = async (values) => {
    try {
      await platformBusinessTemplateService.duplicateTemplate(duplicatingTemplate.id, values);
      setDuplicatingTemplate(null);
      loadTemplates();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to duplicate template.');
    }
  };

  const runAction = async (fn) => {
    setActionError('');
    try {
      await fn();
      loadTemplates();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    }
  };

  const openModules = async (template) => {
    setModulesTemplate(template);
    setModulesError('');
    setModulesLoading(true);
    try {
      const detail = await platformBusinessTemplateService.getTemplateDetail(template.id);
      setModuleRows(detail.modules);
    } catch (err) {
      setModulesError(err.response?.data?.message || 'Failed to load modules.');
    } finally {
      setModulesLoading(false);
    }
  };

  const toggleModuleRow = (moduleId) => {
    setModuleRows((rows) => rows.map((row) => (row.module_id === moduleId ? { ...row, is_enabled: !row.is_enabled } : row)));
  };

  const saveModules = async () => {
    setModulesSaving(true);
    setModulesError('');
    try {
      const payload = moduleRows.filter((row) => !row.is_core).map((row) => ({ moduleId: row.module_id, isEnabled: row.is_enabled }));
      await platformBusinessTemplateService.setTemplateModules(modulesTemplate.id, payload);
      setModulesTemplate(null);
    } catch (err) {
      setModulesError(err.response?.data?.message || 'Failed to save modules.');
    } finally {
      setModulesSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (row) => <strong>{row.name}</strong> },
    { key: 'slug', label: 'Slug', render: (row) => <code>{row.slug}</code> },
    { key: 'description', label: 'Description', render: (row) => row.description || '—' },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`badge ${STATUS_BADGE[row.status]}`}>{row.status}</span>
    ) },
    { key: 'actions', label: '', render: (row) => (
      <div className="table-actions">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => openModules(row)} aria-label="Manage modules"><FiGrid /></button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label="Edit"><FiEdit2 /></button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => openDuplicate(row)} aria-label="Duplicate"><FiCopy /></button>
        {row.status === 'active' ? (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => runAction(() => platformBusinessTemplateService.deactivateTemplate(row.id))} aria-label="Deactivate"><FiSlash /></button>
        ) : row.status === 'inactive' ? (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => runAction(() => platformBusinessTemplateService.activateTemplate(row.id))} aria-label="Activate"><FiCheckCircle /></button>
        ) : null}
        {row.status !== 'archived' && (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => runAction(() => platformBusinessTemplateService.archiveTemplate(row.id))} aria-label="Archive"><FiArchive /></button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Templates</h1>
          <p className="page-subtitle">
            Templates set a tenant's DEFAULT modules only — enable, disable, or override any module for any tenant at any time from Tenant Detail.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <FiPlus aria-hidden="true" /> New Template
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <Table columns={columns} rows={templates} loading={loading} emptyMessage="No templates yet." />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTemplate ? 'Edit Template' : 'New Template'}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="template-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="template-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="name">Name</label>
            <input id="name" className={`form-control ${errors.name ? 'form-control-error' : ''}`} {...register('name', { required: 'Name is required' })} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="slug">Slug</label>
            <input id="slug" className={`form-control ${errors.slug ? 'form-control-error' : ''}`} {...register('slug', { required: 'Slug is required' })} />
            {errors.slug && <span className="form-error">{errors.slug.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea id="description" className="form-control" {...register('description')} />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(duplicatingTemplate)}
        onClose={() => setDuplicatingTemplate(null)}
        title={duplicatingTemplate ? `Duplicate "${duplicatingTemplate.name}"` : ''}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDuplicatingTemplate(null)}>Cancel</button>
            <button type="submit" form="duplicate-form" className={`btn btn-primary ${duplicateSubmitting ? 'btn-loading' : ''}`} disabled={duplicateSubmitting}>
              Duplicate
            </button>
          </>
        }
      >
        <form id="duplicate-form" onSubmit={handleSubmitDuplicate(onSubmitDuplicate)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="duplicate-name">New Name</label>
            <input id="duplicate-name" className={`form-control ${duplicateErrors.name ? 'form-control-error' : ''}`} {...registerDuplicate('name', { required: 'Name is required' })} />
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="duplicate-slug">New Slug</label>
            <input id="duplicate-slug" className={`form-control ${duplicateErrors.slug ? 'form-control-error' : ''}`} {...registerDuplicate('slug', { required: 'Slug is required' })} />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(modulesTemplate)}
        onClose={() => setModulesTemplate(null)}
        title={modulesTemplate ? `Modules — ${modulesTemplate.name}` : ''}
        size="md"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModulesTemplate(null)}>Cancel</button>
            <button type="button" className={`btn btn-primary ${modulesSaving ? 'btn-loading' : ''}`} disabled={modulesSaving || modulesLoading} onClick={saveModules}>
              Save Modules
            </button>
          </>
        }
      >
        {modulesError && <div className="alert alert-danger mb-4" role="alert">{modulesError}</div>}
        {modulesLoading ? (
          <p className="text-sm text-secondary">Loading…</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {moduleRows.map((row) => (
              <li key={row.module_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={row.is_core || row.is_enabled}
                    disabled={row.is_core || !row.is_active}
                    onChange={() => toggleModuleRow(row.module_id)}
                  />
                  {row.name}
                  {row.is_core && <span className="badge badge-info" style={{ marginLeft: 8 }}>Core — always on</span>}
                  {!row.is_active && !row.is_core && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>Not yet available</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

export default TemplateList;
