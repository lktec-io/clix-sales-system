import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageSkeleton from '../../components/common/PageSkeleton';
import * as medicineService from '../../services/medicineService';
import * as categoryService from '../../services/categoryService';
import { useToast } from '../../hooks/useToast';

const UNITS = ['unit', 'tablet', 'capsule', 'bottle', 'box', 'vial', 'tube', 'sachet', 'pack'];

function MedicineForm() {
  const { t } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(isEdit);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '', categoryId: '', unit: 'unit', sellingPrice: '', reorderLevel: '', description: '', status: 'active',
    },
  });

  useEffect(() => {
    categoryService.listActiveCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    medicineService.getMedicine(id).then((medicine) => {
      reset({
        name: medicine.name,
        categoryId: medicine.category_id || '',
        unit: medicine.unit,
        sellingPrice: medicine.selling_price,
        reorderLevel: medicine.reorder_level,
        description: medicine.description || '',
        status: medicine.status,
      });
      setLoading(false);
    });
  }, [id, isEdit, reset]);

  const onSubmit = async (values) => {
    setFormError('');
    const payload = {
      name: values.name.trim(),
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      unit: values.unit,
      sellingPrice: Number(values.sellingPrice),
      reorderLevel: Number(values.reorderLevel),
      description: values.description?.trim() || undefined,
      status: values.status,
    };

    try {
      const medicine = isEdit
        ? await medicineService.updateMedicine(id, payload)
        : await medicineService.createMedicine(payload);
      toast.success(t(isEdit ? 'pharmacy:medicines.form.updateSuccess' : 'pharmacy:medicines.form.createSuccess'));
      navigate(`/medicines/${medicine.id}`, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('pharmacy:medicines.form.saveError'));
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t(isEdit ? 'pharmacy:medicines.form.editTitle' : 'pharmacy:medicines.form.newTitle')}</h1>
          <p className="page-subtitle">{t(isEdit ? 'pharmacy:medicines.form.editSubtitle' : 'pharmacy:medicines.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="name">{t('pharmacy:medicines.form.nameLabel')}</label>
              <input id="name" className={`form-control ${errors.name ? 'form-control-error' : ''}`} {...register('name', { required: t('pharmacy:medicines.form.nameRequired') })} />
              {errors.name && <span className="form-error">{errors.name.message}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="categoryId">{t('pharmacy:medicines.form.categoryLabel')}</label>
                <select id="categoryId" className={`form-control ${errors.categoryId ? 'form-control-error' : ''}`} {...register('categoryId', { required: t('pharmacy:medicines.form.categoryRequired') })}>
                  <option value="">{t('pharmacy:medicines.form.selectCategory')}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.categoryId && <span className="form-error">{errors.categoryId.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="unit">{t('pharmacy:medicines.form.unitLabel')}</label>
                <select id="unit" className="form-control" {...register('unit', { required: t('pharmacy:medicines.form.unitRequired') })}>
                  {UNITS.map((u) => <option key={u} value={u}>{t(`pharmacy:medicines.units.${u}`)}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="sellingPrice">{t('pharmacy:medicines.form.sellingPriceLabel')}</label>
                <input id="sellingPrice" type="number" min="0" step="0.01" className={`form-control ${errors.sellingPrice ? 'form-control-error' : ''}`} {...register('sellingPrice', { required: t('pharmacy:medicines.form.sellingPriceRequired') })} />
                {errors.sellingPrice && <span className="form-error">{errors.sellingPrice.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="reorderLevel">{t('pharmacy:medicines.form.reorderLevelLabel')}</label>
                <input id="reorderLevel" type="number" min="0" step="1" className={`form-control ${errors.reorderLevel ? 'form-control-error' : ''}`} {...register('reorderLevel', { required: t('pharmacy:medicines.form.reorderLevelRequired') })} />
                {errors.reorderLevel && <span className="form-error">{errors.reorderLevel.message}</span>}
              </div>
            </div>

            {isEdit && (
              <div className="form-group">
                <label className="form-label" htmlFor="status">{t('pharmacy:medicines.form.statusLabel')}</label>
                <select id="status" className="form-control" {...register('status')}>
                  <option value="active">{t('pharmacy:medicines.status.active')}</option>
                  <option value="inactive">{t('pharmacy:medicines.status.inactive')}</option>
                </select>
              </div>
            )}

            <div className="form-group mb-0">
              <label className="form-label" htmlFor="description">{t('pharmacy:medicines.form.descriptionLabel')}</label>
              <textarea id="description" className="form-control" rows={3} {...register('description')} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/medicines')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('pharmacy:medicines.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MedicineForm;
