import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageSkeleton from '../../components/common/PageSkeleton';
import * as menuItemService from '../../services/menuItemService';
import * as categoryService from '../../services/categoryService';
import { useToast } from '../../hooks/useToast';

function MenuItemForm() {
  const { t } = useTranslation(['restaurant', 'common']);
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
    defaultValues: { name: '', categoryId: '', sellingPrice: '', description: '', isAvailable: true },
  });

  useEffect(() => {
    categoryService.listActiveCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    menuItemService.getMenuItem(id).then((item) => {
      reset({
        name: item.name,
        categoryId: item.category_id || '',
        sellingPrice: item.selling_price,
        description: item.description || '',
        isAvailable: Boolean(item.is_available),
      });
      setLoading(false);
    });
  }, [id, isEdit, reset]);

  const onSubmit = async (values) => {
    setFormError('');
    const payload = {
      name: values.name.trim(),
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      sellingPrice: Number(values.sellingPrice),
      description: values.description?.trim() || undefined,
      isAvailable: values.isAvailable,
    };

    try {
      if (isEdit) await menuItemService.updateMenuItem(id, payload);
      else await menuItemService.createMenuItem(payload);
      toast.success(t(isEdit ? 'restaurant:menu.form.updateSuccess' : 'restaurant:menu.form.createSuccess'));
      navigate('/menu', { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('restaurant:menu.form.saveError'));
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t(isEdit ? 'restaurant:menu.form.editTitle' : 'restaurant:menu.form.newTitle')}</h1>
          <p className="page-subtitle">{t(isEdit ? 'restaurant:menu.form.editSubtitle' : 'restaurant:menu.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="name">{t('restaurant:menu.form.nameLabel')}</label>
              <input id="name" className={`form-control ${errors.name ? 'form-control-error' : ''}`} {...register('name', { required: t('restaurant:menu.form.nameRequired') })} />
              {errors.name && <span className="form-error">{errors.name.message}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="categoryId">{t('restaurant:menu.form.categoryLabel')}</label>
                <select id="categoryId" className="form-control" {...register('categoryId')}>
                  <option value="">{t('restaurant:menu.form.selectCategory')}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="sellingPrice">{t('restaurant:menu.form.sellingPriceLabel')}</label>
                <input id="sellingPrice" type="number" min="0" step="0.01" className={`form-control ${errors.sellingPrice ? 'form-control-error' : ''}`} {...register('sellingPrice', { required: t('restaurant:menu.form.sellingPriceRequired') })} />
                {errors.sellingPrice && <span className="form-error">{errors.sellingPrice.message}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">{t('restaurant:menu.form.descriptionLabel')}</label>
              <textarea id="description" className="form-control" rows={3} {...register('description')} />
            </div>

            <div className="form-group mb-0">
              <label className="form-checkbox">
                <input type="checkbox" {...register('isAvailable')} />
                {t('restaurant:menu.form.isAvailableLabel')}
              </label>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/menu')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('restaurant:menu.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MenuItemForm;
