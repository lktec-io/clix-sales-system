import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as branchService from '../../services/branchService';
import * as userService from '../../services/userService';
import PageSkeleton from '../../components/common/PageSkeleton';
import { useToast } from '../../hooks/useToast';

function BranchForm() {
  const { t } = useTranslation(['settings', 'common']);
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '', code: '', managerId: '', phone: '', email: '',
      address: '', region: '', district: '', openingDate: '',
    },
  });

  useEffect(() => {
    userService.listUsers({ limit: 100 }).then((result) => setManagers(result.items));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    branchService.getBranch(id).then((branch) => {
      if (cancelled) return;
      reset({
        name: branch.name,
        code: branch.code,
        managerId: branch.manager_id ? String(branch.manager_id) : '',
        phone: branch.phone || '',
        email: branch.email || '',
        address: branch.address || '',
        region: branch.region || '',
        district: branch.district || '',
        openingDate: branch.opening_date ? branch.opening_date.slice(0, 10) : '',
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, reset]);

  const onSubmit = async (values) => {
    setFormError('');
    const payload = { ...values, managerId: values.managerId ? Number(values.managerId) : null };

    try {
      if (isEdit) {
        await branchService.updateBranch(id, payload);
        toast.success(t('settings:branches.form.updateSuccess'));
      } else {
        await branchService.createBranch(payload);
        toast.success(t('settings:branches.form.createSuccess'));
      }
      navigate('/settings/branches');
    } catch (err) {
      setFormError(err.response?.data?.message || t('settings:branches.form.saveError'));
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? t('settings:branches.form.editTitle') : t('settings:branches.form.newTitle')}</h1>
          <p className="page-subtitle">{isEdit ? t('settings:branches.form.editSubtitle') : t('settings:branches.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('settings:branches.form.details')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="name">{t('settings:branches.form.name')}</label>
                <input id="name" className={`form-control ${errors.name ? 'form-control-error' : ''}`} {...register('name', { required: t('settings:branches.form.nameRequired') })} />
                {errors.name && <span className="form-error">{errors.name.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="code">{t('settings:branches.form.code')}</label>
                <input id="code" className={`form-control ${errors.code ? 'form-control-error' : ''}`} {...register('code', { required: t('settings:branches.form.codeRequired') })} />
                {errors.code && <span className="form-error">{errors.code.message}</span>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="managerId">{t('settings:branches.form.manager')}</label>
                <select id="managerId" className="form-control" {...register('managerId')}>
                  <option value="">{t('settings:branches.form.unassigned')}</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>{manager.first_name} {manager.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="openingDate">{t('settings:branches.form.openingDate')}</label>
                <input id="openingDate" type="date" className="form-control" {...register('openingDate')} />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('settings:branches.form.contactAndAddress')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="phone">{t('settings:branches.form.phone')}</label>
                <input id="phone" className="form-control" {...register('phone')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">{t('common:labels.email')}</label>
                <input
                  id="email"
                  type="email"
                  className={`form-control ${errors.email ? 'form-control-error' : ''}`}
                  {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: t('settings:branches.form.invalidEmail') } })}
                />
                {errors.email && <span className="form-error">{errors.email.message}</span>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="address">{t('settings:branches.form.address')}</label>
              <input id="address" className="form-control" {...register('address')} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="region">{t('settings:branches.form.region')}</label>
                <input id="region" className="form-control" {...register('region')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="district">{t('settings:branches.form.district')}</label>
                <input id="district" className="form-control" {...register('district')} />
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/settings/branches')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {isEdit ? t('common:actions.saveChanges') : t('settings:branches.form.createBranch')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BranchForm;
