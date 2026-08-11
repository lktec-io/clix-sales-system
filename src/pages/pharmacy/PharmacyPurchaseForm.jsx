import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import * as pharmacyPurchaseService from '../../services/pharmacyPurchaseService';
import * as medicineService from '../../services/medicineService';
import * as supplierService from '../../services/supplierService';
import * as branchService from '../../services/branchService';
import { useToast } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/formatCurrency';

const EMPTY_ITEM = { medicineId: '', batchNumber: '', quantity: 1, buyingPrice: '', sellingPrice: '', expiryDate: '' };

function PharmacyPurchaseForm() {
  const { t } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [formError, setFormError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      supplierId: '', branchId: '', reference: '', purchaseDate: new Date().toISOString().slice(0, 10),
      items: [{ ...EMPTY_ITEM }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  useEffect(() => {
    medicineService.listActiveMedicines().then(setMedicines);
    supplierService.listActiveSuppliers().then(setSuppliers);
    branchService.listActiveBranches().then((rows) => {
      setBranches(rows);
      if (rows.length === 1) setValue('branchId', rows[0].id);
    });
  }, [setValue]);

  const total = watchedItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.buyingPrice) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = async (values) => {
    setFormError('');
    const payload = {
      supplierId: Number(values.supplierId),
      branchId: Number(values.branchId),
      reference: values.reference?.trim() || undefined,
      purchaseDate: values.purchaseDate || undefined,
      items: values.items.map((item) => ({
        medicineId: Number(item.medicineId),
        batchNumber: item.batchNumber.trim(),
        quantity: Number(item.quantity),
        buyingPrice: Number(item.buyingPrice),
        sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : undefined,
        expiryDate: item.expiryDate,
      })),
    };

    try {
      const purchase = await pharmacyPurchaseService.receiveStock(payload);
      toast.success(t('pharmacy:purchases.form.createSuccess'));
      navigate(`/pharmacy/purchases/${purchase.id}`, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('pharmacy:purchases.form.createError'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pharmacy:purchases.form.newTitle')}</h1>
          <p className="page-subtitle">{t('pharmacy:purchases.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('pharmacy:purchases.form.detailsTitle')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="supplierId">{t('pharmacy:purchases.form.supplierLabel')}</label>
                <select id="supplierId" className={`form-control ${errors.supplierId ? 'form-control-error' : ''}`} {...register('supplierId', { required: t('pharmacy:purchases.form.supplierRequired') })}>
                  <option value="">{t('pharmacy:purchases.form.selectSupplier')}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {errors.supplierId && <span className="form-error">{errors.supplierId.message}</span>}
              </div>
              {branches.length > 1 && (
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="branchId">{t('pharmacy:purchases.form.branchLabel')}</label>
                  <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: t('pharmacy:purchases.form.branchRequired') })}>
                    <option value="">{t('pharmacy:purchases.form.selectBranch')}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {errors.branchId && <span className="form-error">{errors.branchId.message}</span>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="purchaseDate">{t('pharmacy:purchases.form.purchaseDateLabel')}</label>
                <input id="purchaseDate" type="date" className="form-control" {...register('purchaseDate')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reference">{t('pharmacy:purchases.form.referenceLabel')}</label>
                <input id="reference" className="form-control" {...register('reference')} />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">{t('pharmacy:purchases.form.itemsTitle')}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => append({ ...EMPTY_ITEM })}>
              <FiPlus aria-hidden="true" /> {t('pharmacy:purchases.form.addLine')}
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('pharmacy:purchases.itemColumns.medicine')}</th>
                  <th>{t('pharmacy:purchases.form.batchNumberLabel')}</th>
                  <th>{t('pharmacy:purchases.itemColumns.expiryDate')}</th>
                  <th>{t('pharmacy:purchases.itemColumns.quantity')}</th>
                  <th>{t('pharmacy:purchases.itemColumns.buyingPrice')}</th>
                  <th>{t('pharmacy:purchases.form.sellingPriceLabel')}</th>
                  <th>{t('pharmacy:purchases.itemColumns.lineTotal')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const qty = Number(watchedItems[index]?.quantity) || 0;
                  const price = Number(watchedItems[index]?.buyingPrice) || 0;
                  return (
                    <tr key={field.id}>
                      <td style={{ minWidth: 160 }}>
                        <select className="form-control" {...register(`items.${index}.medicineId`, { required: true })}>
                          <option value="">{t('pharmacy:purchases.form.selectMedicine')}</option>
                          {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </td>
                      <td style={{ width: 120 }}>
                        <input className="form-control" {...register(`items.${index}.batchNumber`, { required: true })} />
                      </td>
                      <td style={{ width: 150 }}>
                        <input type="date" className="form-control" {...register(`items.${index}.expiryDate`, { required: true })} />
                      </td>
                      <td style={{ width: 90 }}>
                        <input type="number" min="1" className="form-control" {...register(`items.${index}.quantity`, { required: true, min: 1 })} />
                      </td>
                      <td style={{ width: 120 }}>
                        <input type="number" step="0.01" min="0" className="form-control" {...register(`items.${index}.buyingPrice`, { required: true, min: 0 })} />
                      </td>
                      <td style={{ width: 120 }}>
                        <input type="number" step="0.01" min="0" className="form-control" {...register(`items.${index}.sellingPrice`)} />
                      </td>
                      <td className="text-sm">{formatCurrency(qty * price)}</td>
                      <td>
                        {fields.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(index)} aria-label={t('pharmacy:purchases.form.removeLine')}>
                            <FiTrash2 />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-footer flex justify-end">
            <span className="text-lg font-semibold">{t('pharmacy:purchases.form.totalLabel')}: {formatCurrency(total)}</span>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/pharmacy/purchases')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('pharmacy:purchases.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PharmacyPurchaseForm;
