import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiPlus, FiEdit2, FiArrowUp, FiArrowDown, FiStar, FiCheckCircle, FiSlash } from 'react-icons/fi';
import Table from '../../../components/common/Table';
import Modal from '../../../components/common/Modal';
import * as platformPlanService from '../../../services/platformPlanService';

const DEFAULT_VALUES = {
  name: '', slug: '', description: '', priceMonthly: 0, priceQuarterly: 0, priceYearly: 0, currency: 'TZS',
};

function PlanList() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: DEFAULT_VALUES });

  const loadPlans = async () => {
    setLoading(true);
    try {
      const rows = await platformPlanService.listPlans();
      setPlans(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlans();
  }, []);

  const openCreate = () => {
    setEditingPlan(null);
    reset(DEFAULT_VALUES);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    reset({
      name: plan.name, slug: plan.slug, description: plan.description || '',
      priceMonthly: Number(plan.price_monthly), priceQuarterly: Number(plan.price_quarterly), priceYearly: Number(plan.price_yearly),
      currency: plan.currency,
    });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    const payload = {
      ...values,
      priceMonthly: Number(values.priceMonthly),
      priceQuarterly: Number(values.priceQuarterly),
      priceYearly: Number(values.priceYearly),
    };
    try {
      if (editingPlan) await platformPlanService.updatePlan(editingPlan.id, payload);
      else await platformPlanService.createPlan(payload);
      setModalOpen(false);
      loadPlans();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save plan.');
    }
  };

  const runAction = async (fn) => {
    setActionError('');
    try {
      await fn();
      loadPlans();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    }
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const orderedIds = plans.map((p) => p.id);
    [orderedIds[index - 1], orderedIds[index]] = [orderedIds[index], orderedIds[index - 1]];
    runAction(() => platformPlanService.reorderPlans(orderedIds));
  };

  const moveDown = (index) => {
    if (index === plans.length - 1) return;
    const orderedIds = plans.map((p) => p.id);
    [orderedIds[index + 1], orderedIds[index]] = [orderedIds[index], orderedIds[index + 1]];
    runAction(() => platformPlanService.reorderPlans(orderedIds));
  };

  const columns = [
    { key: 'sort_order', label: 'Order', render: (row) => {
      const i = plans.findIndex((p) => p.id === row.id);
      return (
        <div className="flex gap-1">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => moveUp(i)} disabled={i === 0} aria-label="Move up"><FiArrowUp /></button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => moveDown(i)} disabled={i === plans.length - 1} aria-label="Move down"><FiArrowDown /></button>
        </div>
      );
    } },
    { key: 'name', label: 'Name', render: (row) => (
      <span className="flex items-center gap-2">
        {row.name}
        {row.is_recommended ? <span className="badge badge-info">Recommended</span> : null}
      </span>
    ) },
    { key: 'price_monthly', label: 'Monthly' },
    { key: 'price_quarterly', label: 'Quarterly' },
    { key: 'price_yearly', label: 'Yearly' },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`badge ${row.is_active ? 'badge-success' : 'badge-neutral'}`}>{row.is_active ? 'Active' : 'Inactive'}</span>
    ) },
    { key: 'actions', label: '', render: (row) => (
      <div className="table-actions">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label="Edit"><FiEdit2 /></button>
        {!row.is_recommended && (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => runAction(() => platformPlanService.markRecommended(row.id))} aria-label="Mark recommended"><FiStar /></button>
        )}
        {row.is_active ? (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => runAction(() => platformPlanService.deactivatePlan(row.id))} aria-label="Deactivate"><FiSlash /></button>
        ) : (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => runAction(() => platformPlanService.activatePlan(row.id))} aria-label="Activate"><FiCheckCircle /></button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscription Plans</h1>
          <p className="page-subtitle">Manage pricing, availability, and ordering for the platform's subscription plans.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <FiPlus aria-hidden="true" /> New Plan
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <Table columns={columns} rows={plans} loading={loading} emptyMessage="No plans yet." />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlan ? 'Edit Plan' : 'New Plan'}
        size="md"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="plan-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="plan-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label form-label-required" htmlFor="priceMonthly">Monthly Price</label>
              <input id="priceMonthly" type="number" min="0" step="0.01" className="form-control" {...register('priceMonthly', { required: true, min: 0 })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label form-label-required" htmlFor="priceQuarterly">Quarterly Price</label>
              <input id="priceQuarterly" type="number" min="0" step="0.01" className="form-control" {...register('priceQuarterly', { required: true, min: 0 })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label form-label-required" htmlFor="priceYearly">Yearly Price</label>
              <input id="priceYearly" type="number" min="0" step="0.01" className="form-control" {...register('priceYearly', { required: true, min: 0 })} />
            </div>
          </div>
          <div className="form-group" style={{ maxWidth: 160 }}>
            <label className="form-label" htmlFor="currency">Currency</label>
            <input id="currency" className="form-control" {...register('currency')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PlanList;
