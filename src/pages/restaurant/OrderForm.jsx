import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import * as restaurantOrderService from '../../services/restaurantOrderService';
import * as menuItemService from '../../services/menuItemService';
import * as restaurantTableService from '../../services/restaurantTableService';
import * as customerService from '../../services/customerService';
import * as branchService from '../../services/branchService';
import { useToast } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/formatCurrency';

function OrderForm() {
  const { t } = useTranslation(['restaurant', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
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
      branchId: '', tableId: '', customerId: '',
      items: [{ menuItemId: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  useEffect(() => {
    menuItemService.listActiveMenuItems().then(setMenuItems);
    restaurantTableService.listAvailableTables().then(setTables);
    customerService.listActiveCustomers().then(setCustomers);
    branchService.listActiveBranches().then((rows) => {
      setBranches(rows);
      if (rows.length === 1) setValue('branchId', rows[0].id);
    });
  }, [setValue]);

  const menuItemById = (id) => menuItems.find((m) => String(m.id) === String(id));

  const total = watchedItems.reduce((sum, item) => {
    const menuItem = menuItemById(item.menuItemId);
    const qty = Number(item.quantity) || 0;
    const price = Number(menuItem?.selling_price) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = async (values) => {
    setFormError('');
    const payload = {
      branchId: Number(values.branchId),
      tableId: values.tableId ? Number(values.tableId) : undefined,
      customerId: values.customerId ? Number(values.customerId) : undefined,
      items: values.items.map((item) => ({
        menuItemId: Number(item.menuItemId),
        quantity: Number(item.quantity),
      })),
    };

    try {
      const order = await restaurantOrderService.createOrder(payload);
      toast.success(t('restaurant:orders.form.createSuccess'));
      navigate(`/restaurant/orders/${order.id}`, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('restaurant:orders.form.createError'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('restaurant:orders.form.newTitle')}</h1>
          <p className="page-subtitle">{t('restaurant:orders.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card mb-5">
          <div className="card-body">
            <div className="form-row">
              {branches.length > 1 && (
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="branchId">{t('restaurant:orders.form.branchLabel')}</label>
                  <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: t('restaurant:orders.form.branchRequired') })}>
                    <option value="">{t('restaurant:orders.form.selectBranch')}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {errors.branchId && <span className="form-error">{errors.branchId.message}</span>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="tableId">{t('restaurant:orders.form.tableLabel')}</label>
                <select id="tableId" className="form-control" {...register('tableId')}>
                  <option value="">{t('restaurant:orders.form.selectTable')}</option>
                  {tables.map((tb) => <option key={tb.id} value={tb.id}>{tb.table_number}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="customerId">{t('restaurant:orders.form.customerLabel')}</label>
                <select id="customerId" className="form-control" {...register('customerId')}>
                  <option value="">{t('restaurant:orders.form.selectCustomer')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">{t('restaurant:orders.form.itemsTitle')}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => append({ menuItemId: '', quantity: 1 })}>
              <FiPlus aria-hidden="true" /> {t('restaurant:orders.form.addLine')}
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('restaurant:orders.itemColumns.item')}</th>
                  <th>{t('restaurant:orders.itemColumns.quantity')}</th>
                  <th>{t('restaurant:orders.itemColumns.unitPrice')}</th>
                  <th>{t('restaurant:orders.itemColumns.lineTotal')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const menuItem = menuItemById(watchedItems[index]?.menuItemId);
                  const qty = Number(watchedItems[index]?.quantity) || 0;
                  const price = Number(menuItem?.selling_price) || 0;
                  return (
                    <tr key={field.id}>
                      <td>
                        <select className="form-control" {...register(`items.${index}.menuItemId`, { required: true })}>
                          <option value="">{t('restaurant:orders.form.selectMenuItem')}</option>
                          {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </td>
                      <td style={{ width: 100 }}>
                        <input type="number" min="1" className="form-control" {...register(`items.${index}.quantity`, { required: true, min: 1 })} />
                      </td>
                      <td className="text-sm">{formatCurrency(price)}</td>
                      <td className="text-sm">{formatCurrency(qty * price)}</td>
                      <td>
                        {fields.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(index)} aria-label={t('restaurant:orders.form.removeLine')}>
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
            <span className="text-lg font-semibold">{t('restaurant:orders.form.total')}: {formatCurrency(total)}</span>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/restaurant/orders')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('restaurant:orders.form.confirmOrder')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default OrderForm;
