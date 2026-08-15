import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus } from 'react-icons/fi';
import PageSkeleton from '../../components/common/PageSkeleton';
import QuickAddModal from '../../components/common/QuickAddModal';
import * as medicineService from '../../services/medicineService';
import * as categoryService from '../../services/categoryService';
import * as branchService from '../../services/branchService';
import { useToast } from '../../hooks/useToast';

const UNITS = ['unit', 'tablet', 'capsule', 'bottle', 'box', 'vial', 'tube', 'sachet', 'pack'];

function MedicineForm() {
  const { t } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [addOpeningStock, setAddOpeningStock] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(isEdit);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '', barcode: '', categoryId: '', unit: 'unit', sellingPrice: '', reorderLevel: '', description: '', status: 'active',
      stockQuantity: '', stockBuyingPrice: '', stockBatchNumber: '', stockExpiryDate: '', stockBranchId: '',
    },
  });

  useEffect(() => {
    categoryService.listActiveCategories().then(setCategories);
    if (!isEdit) {
      branchService.listActiveBranches().then((rows) => {
        setBranches(rows);
        if (rows.length === 1) setValue('stockBranchId', rows[0].id);
      });
    }
  }, [isEdit, setValue]);

  useEffect(() => {
    if (!isEdit) return;
    medicineService.getMedicine(id).then((medicine) => {
      reset({
        name: medicine.name,
        barcode: medicine.barcode || '',
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
      barcode: values.barcode?.trim() || undefined,
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      unit: values.unit,
      sellingPrice: Number(values.sellingPrice),
      reorderLevel: Number(values.reorderLevel),
      description: values.description?.trim() || undefined,
      status: values.status,
    };

    if (!isEdit && addOpeningStock && Number(values.stockQuantity) > 0) {
      payload.initialStock = {
        quantity: Number(values.stockQuantity),
        buyingPrice: values.stockBuyingPrice ? Number(values.stockBuyingPrice) : undefined,
        batchNumber: values.stockBatchNumber.trim(),
        expiryDate: values.stockExpiryDate,
        branchId: Number(values.stockBranchId),
      };
    }

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

  const handleCreateCategory = async ({ name, code }) => {
    const created = await categoryService.createCategory({ name, code });
    const refreshed = await categoryService.listActiveCategories();
    setCategories(refreshed);
    setValue('categoryId', String(created.id), { shouldValidate: true });
    setCategoryModalOpen(false);
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
                <div className="flex items-center justify-between">
                  <label className="form-label form-label-required" htmlFor="categoryId">{t('pharmacy:medicines.form.categoryLabel')}</label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCategoryModalOpen(true)}>
                    <FiPlus aria-hidden="true" /> {t('common:quickAdd.addCategory')}
                  </button>
                </div>
                <select id="categoryId" className={`form-control ${errors.categoryId ? 'form-control-error' : ''}`} {...register('categoryId', { required: t('pharmacy:medicines.form.categoryRequired') })}>
                  <option value="">{t('pharmacy:medicines.form.selectCategory')}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.categoryId && <span className="form-error">{errors.categoryId.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="barcode">{t('pharmacy:medicines.form.barcodeLabel')}</label>
                <input id="barcode" className="form-control" {...register('barcode')} />
              </div>
            </div>

            <div className="form-row">
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

        {!isEdit && (
          <div className="card mt-5">
            <div className="card-header">
              <label className="form-checkbox" htmlFor="addOpeningStock" style={{ margin: 0 }}>
                <input
                  id="addOpeningStock"
                  type="checkbox"
                  checked={addOpeningStock}
                  onChange={(e) => setAddOpeningStock(e.target.checked)}
                />
                <span className="card-title">{t('pharmacy:medicines.form.addOpeningStock')}</span>
              </label>
            </div>
            {addOpeningStock && (
              <div className="card-body">
                <p className="text-sm text-secondary mb-4">{t('pharmacy:medicines.form.openingStockHint')}</p>
                <div className="form-row">
                  {branches.length > 1 && (
                    <div className="form-group">
                      <label className="form-label form-label-required" htmlFor="stockBranchId">{t('pharmacy:medicines.form.branchLabel')}</label>
                      <select id="stockBranchId" className="form-control" {...register('stockBranchId', { required: addOpeningStock })}>
                        <option value="">{t('pharmacy:medicines.form.selectBranch')}</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="stockQuantity">{t('pharmacy:medicines.form.quantityLabel')}</label>
                    <input id="stockQuantity" type="number" min="1" step="1" className="form-control" {...register('stockQuantity', { required: addOpeningStock, min: 1 })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="stockBuyingPrice">{t('pharmacy:medicines.form.buyingPriceLabel')}</label>
                    <input id="stockBuyingPrice" type="number" min="0" step="0.01" className="form-control" {...register('stockBuyingPrice')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="stockBatchNumber">{t('pharmacy:medicines.form.batchNumberLabel')}</label>
                    <input id="stockBatchNumber" className="form-control" {...register('stockBatchNumber', { required: addOpeningStock })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="stockExpiryDate">{t('pharmacy:medicines.form.expiryDateLabel')}</label>
                    <input id="stockExpiryDate" type="date" className="form-control" {...register('stockExpiryDate', { required: addOpeningStock })} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/medicines')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('pharmacy:medicines.form.save')}
          </button>
        </div>
      </form>

      <QuickAddModal
        open={categoryModalOpen}
        title={t('common:quickAdd.addCategory')}
        onClose={() => setCategoryModalOpen(false)}
        onCreate={handleCreateCategory}
      />
    </div>
  );
}

export default MedicineForm;
