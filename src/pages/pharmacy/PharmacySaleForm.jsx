import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import * as pharmacySaleService from '../../services/pharmacySaleService';
import * as medicineService from '../../services/medicineService';
import * as customerService from '../../services/customerService';
import * as branchService from '../../services/branchService';
import { useToast } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/formatCurrency';

function PharmacySaleForm() {
  const { t } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const [medicines, setMedicines] = useState([]);
  const [customers, setCustomers] = useState([]);
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
      branchId: '', customerId: '', paymentMethod: 'cash',
      items: [{ medicineId: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  useEffect(() => {
    medicineService.listActiveMedicines().then(setMedicines);
    customerService.listActiveCustomers().then(setCustomers);
    branchService.listActiveBranches().then((rows) => {
      setBranches(rows);
      if (rows.length === 1) setValue('branchId', rows[0].id);
    });
  }, [setValue]);

  const medicineById = (id) => medicines.find((m) => String(m.id) === String(id));

  // Estimated only — the backend allocates against FEFO batches (earliest
  // expiry first) and each batch can carry its own selling_price override,
  // so the medicine's own list price is a preview, not the authoritative
  // total. sellMedicines() in the backend always recomputes the real total.
  const total = watchedItems.reduce((sum, item) => {
    const medicine = medicineById(item.medicineId);
    const qty = Number(item.quantity) || 0;
    const price = Number(medicine?.selling_price) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = async (values) => {
    setFormError('');
    const payload = {
      branchId: Number(values.branchId),
      customerId: values.customerId ? Number(values.customerId) : undefined,
      paymentMethod: values.paymentMethod,
      items: values.items.map((item) => ({
        medicineId: Number(item.medicineId),
        quantity: Number(item.quantity),
      })),
    };

    try {
      const sale = await pharmacySaleService.createSale(payload);
      toast.success(t('pharmacy:sales.form.createSuccess'));
      navigate(`/pharmacy/sales/${sale.id}`, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('pharmacy:sales.form.createError'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pharmacy:sales.form.newTitle')}</h1>
          <p className="page-subtitle">{t('pharmacy:sales.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card mb-5">
          <div className="card-body">
            <div className="form-row">
              {branches.length > 1 && (
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="branchId">{t('pharmacy:sales.form.branchLabel')}</label>
                  <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: t('pharmacy:sales.form.branchRequired') })}>
                    <option value="">{t('pharmacy:sales.form.selectBranch')}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {errors.branchId && <span className="form-error">{errors.branchId.message}</span>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="customerId">{t('pharmacy:sales.form.customerLabel')}</label>
                <select id="customerId" className="form-control" {...register('customerId')}>
                  <option value="">{t('pharmacy:sales.form.selectCustomer')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="paymentMethod">{t('pharmacy:sales.form.paymentMethodLabel')}</label>
                <select id="paymentMethod" className="form-control" {...register('paymentMethod')}>
                  <option value="cash">{t('pharmacy:sales.paymentMethods.cash')}</option>
                  <option value="mobile_money">{t('pharmacy:sales.paymentMethods.mobile_money')}</option>
                  <option value="bank_transfer">{t('pharmacy:sales.paymentMethods.bank_transfer')}</option>
                  <option value="card">{t('pharmacy:sales.paymentMethods.card')}</option>
                  <option value="other">{t('pharmacy:sales.paymentMethods.other')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">{t('pharmacy:sales.form.itemsTitle')}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => append({ medicineId: '', quantity: 1 })}>
              <FiPlus aria-hidden="true" /> {t('pharmacy:sales.form.addLine')}
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('pharmacy:sales.itemColumns.medicine')}</th>
                  <th>{t('pharmacy:sales.itemColumns.quantity')}</th>
                  <th>{t('pharmacy:sales.form.estimatedUnitPrice')}</th>
                  <th>{t('pharmacy:sales.itemColumns.lineTotal')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const medicine = medicineById(watchedItems[index]?.medicineId);
                  const qty = Number(watchedItems[index]?.quantity) || 0;
                  const price = Number(medicine?.selling_price) || 0;
                  return (
                    <tr key={field.id}>
                      <td>
                        <select className="form-control" {...register(`items.${index}.medicineId`, { required: true })}>
                          <option value="">{t('pharmacy:sales.form.selectMedicine')}</option>
                          {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </td>
                      <td style={{ width: 100 }}>
                        <input type="number" min="1" className="form-control" {...register(`items.${index}.quantity`, { required: true, min: 1 })} />
                      </td>
                      <td className="text-sm">{formatCurrency(price)}</td>
                      <td className="text-sm">{formatCurrency(qty * price)}</td>
                      <td>
                        {fields.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(index)} aria-label={t('pharmacy:sales.form.removeLine')}>
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
          <div className="card-footer flex justify-end items-center gap-4">
            <span className="text-xs text-secondary">{t('pharmacy:sales.form.estimatedNote')}</span>
            <span className="text-lg font-semibold">{t('pharmacy:sales.form.estimatedTotal')}: {formatCurrency(total)}</span>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/pharmacy/sales')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('pharmacy:sales.form.completeSale')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PharmacySaleForm;
