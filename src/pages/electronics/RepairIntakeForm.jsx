import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as repairService from '../../services/repairService';
import * as customerService from '../../services/customerService';
import * as branchService from '../../services/branchService';
import * as userService from '../../services/userService';
import { useToast } from '../../hooks/useToast';

const DEVICE_TYPES = ['smartphone', 'tablet', 'laptop', 'desktop', 'printer', 'other'];
const ACCESSORY_KEYS = ['charger', 'cable', 'battery', 'sim', 'memoryCard', 'bag', 'other'];

// Each condition field's own valid options — mirrors the exact checklist
// requested (Screen/Body/Back Cover/Camera/Charging Port/Buttons/Battery),
// rendered as compact <select>s rather than literal radio buttons so the
// whole checklist stays usable on a small screen with one thumb.
const CONDITION_FIELDS = [
  { key: 'screen', options: ['good', 'scratched', 'cracked', 'broken'] },
  { key: 'body', options: ['good', 'scratched', 'dented', 'broken'] },
  { key: 'backCover', options: ['good', 'scratched', 'cracked', 'missing'] },
  { key: 'camera', options: ['working', 'faulty', 'damaged'] },
  { key: 'chargingPort', options: ['working', 'faulty', 'damaged'] },
  { key: 'buttons', options: ['working', 'faulty', 'damaged'] },
  { key: 'battery', options: ['good', 'weak', 'swollen', 'faulty'] },
];

function RepairIntakeForm() {
  const { t } = useTranslation(['electronics', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      customerId: '', branchId: '', technicianId: '', deviceType: 'smartphone',
      brand: '', model: '', serialNumber: '', imei1: '', imei2: '', deviceColor: '',
      reportedProblem: '', estimatedCost: '', expectedCompletionAt: '',
      depositAmount: '', depositPaymentMethod: 'cash',
      accessories: { charger: false, cable: false, battery: false, sim: false, memoryCard: false, bag: false, other: false },
      condition: { screen: 'good', body: 'good', backCover: 'good', camera: 'working', chargingPort: 'working', buttons: 'working', battery: 'good' },
      conditionNotes: '',
    },
  });

  const depositAmount = watch('depositAmount');

  useEffect(() => {
    customerService.listActiveCustomers().then(setCustomers);
    userService.listUsers({ limit: 200 }).then((result) => setTechnicians(result.items || []));
    branchService.listActiveBranches().then((rows) => {
      setBranches(rows);
      if (rows.length === 1) setValue('branchId', rows[0].id);
    });
  }, [setValue]);

  const onSubmit = async (values) => {
    setFormError('');
    const payload = {
      customerId: Number(values.customerId),
      branchId: Number(values.branchId),
      technicianId: values.technicianId ? Number(values.technicianId) : undefined,
      deviceType: values.deviceType,
      brand: values.brand.trim(),
      model: values.model.trim(),
      serialNumber: values.serialNumber?.trim() || undefined,
      imei1: values.imei1?.trim() || undefined,
      imei2: values.imei2?.trim() || undefined,
      deviceColor: values.deviceColor?.trim() || undefined,
      reportedProblem: values.reportedProblem.trim(),
      estimatedCost: values.estimatedCost === '' ? undefined : Number(values.estimatedCost),
      expectedCompletionAt: values.expectedCompletionAt || undefined,
      depositAmount: values.depositAmount === '' ? undefined : Number(values.depositAmount),
      depositPaymentMethod: values.depositAmount === '' ? undefined : values.depositPaymentMethod,
      accessoriesReceived: values.accessories,
      deviceCondition: { ...values.condition, notes: values.conditionNotes?.trim() || undefined },
    };

    try {
      const repair = await repairService.createIntake(payload);
      toast.success(t('electronics:repairs.form.createSuccess'));
      navigate(`/repairs/${repair.id}`, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('electronics:repairs.form.createError'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('electronics:repairs.form.newTitle')}</h1>
          <p className="page-subtitle">{t('electronics:repairs.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.form.customerSection')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="customerId">{t('electronics:repairs.form.customerLabel')}</label>
                <select id="customerId" className={`form-control ${errors.customerId ? 'form-control-error' : ''}`} {...register('customerId', { required: t('electronics:repairs.form.customerRequired') })}>
                  <option value="">{t('electronics:repairs.form.selectCustomer')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
                {errors.customerId && <span className="form-error">{errors.customerId.message}</span>}
              </div>
              {branches.length > 1 && (
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="branchId">{t('electronics:repairs.form.branchLabel')}</label>
                  <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: t('electronics:repairs.form.branchRequired') })}>
                    <option value="">{t('electronics:repairs.form.selectBranch')}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {errors.branchId && <span className="form-error">{errors.branchId.message}</span>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="technicianId">{t('electronics:repairs.form.technicianLabel')}</label>
                <select id="technicianId" className="form-control" {...register('technicianId')}>
                  <option value="">{t('electronics:repairs.form.selectTechnician')}</option>
                  {technicians.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="deviceType">{t('electronics:repairs.form.deviceTypeLabel')}</label>
                <select id="deviceType" className="form-control" {...register('deviceType')}>
                  {DEVICE_TYPES.map((type) => <option key={type} value={type}>{t(`electronics:repairs.deviceTypes.${type}`)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="brand">{t('electronics:repairs.form.brandLabel')}</label>
                <input id="brand" className={`form-control ${errors.brand ? 'form-control-error' : ''}`} {...register('brand', { required: t('electronics:repairs.form.brandRequired') })} />
                {errors.brand && <span className="form-error">{errors.brand.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="model">{t('electronics:repairs.form.modelLabel')}</label>
                <input id="model" className={`form-control ${errors.model ? 'form-control-error' : ''}`} {...register('model', { required: t('electronics:repairs.form.modelRequired') })} />
                {errors.model && <span className="form-error">{errors.model.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="deviceColor">{t('electronics:repairs.form.deviceColorLabel')}</label>
                <input id="deviceColor" className="form-control" {...register('deviceColor')} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="serialNumber">{t('electronics:repairs.form.serialNumberLabel')}</label>
                <input id="serialNumber" className="form-control" {...register('serialNumber')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="imei1">{t('electronics:repairs.form.imei1Label')}</label>
                <input id="imei1" className="form-control" {...register('imei1')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="imei2">{t('electronics:repairs.form.imei2Label')}</label>
                <input id="imei2" className="form-control" {...register('imei2')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="expectedCompletionAt">{t('electronics:repairs.form.expectedCompletionLabel')}</label>
                <input id="expectedCompletionAt" type="date" className="form-control" {...register('expectedCompletionAt')} />
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label form-label-required" htmlFor="reportedProblem">{t('electronics:repairs.form.reportedProblemLabel')}</label>
              <textarea id="reportedProblem" className={`form-control ${errors.reportedProblem ? 'form-control-error' : ''}`} rows={3} {...register('reportedProblem', { required: t('electronics:repairs.form.reportedProblemRequired') })} />
              {errors.reportedProblem && <span className="form-error">{errors.reportedProblem.message}</span>}
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.form.estimateSection')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="estimatedCost">{t('electronics:repairs.form.estimatedCostLabel')}</label>
                <input id="estimatedCost" type="number" min="0" step="0.01" className="form-control" {...register('estimatedCost')} />
                <span className="form-help">{t('electronics:repairs.form.estimatedCostHelp')}</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="depositAmount">{t('electronics:repairs.form.depositAmountLabel')}</label>
                <input id="depositAmount" type="number" min="0" step="0.01" className="form-control" {...register('depositAmount')} />
              </div>
              {depositAmount && (
                <div className="form-group">
                  <label className="form-label" htmlFor="depositPaymentMethod">{t('electronics:repairs.form.depositPaymentMethodLabel')}</label>
                  <select id="depositPaymentMethod" className="form-control" {...register('depositPaymentMethod')}>
                    <option value="cash">{t('electronics:repairs.paymentMethods.cash')}</option>
                    <option value="mobile_money">{t('electronics:repairs.paymentMethods.mobile_money')}</option>
                    <option value="bank_transfer">{t('electronics:repairs.paymentMethods.bank_transfer')}</option>
                    <option value="card">{t('electronics:repairs.paymentMethods.card')}</option>
                    <option value="other">{t('electronics:repairs.paymentMethods.other')}</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.form.accessoriesSection')}</span></div>
          <div className="card-body form-row">
            {ACCESSORY_KEYS.map((key) => (
              <label key={key} className="form-checkbox">
                <input type="checkbox" {...register(`accessories.${key}`)} />
                {t(`electronics:repairs.form.accessories.${key}`)}
              </label>
            ))}
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.form.conditionSection')}</span></div>
          <div className="card-body">
            <div className="form-row">
              {CONDITION_FIELDS.map(({ key, options }) => (
                <div className="form-group" key={key}>
                  <label className="form-label" htmlFor={`condition-${key}`}>{t(`electronics:repairs.condition.${key}`)}</label>
                  <select id={`condition-${key}`} className="form-control" {...register(`condition.${key}`)}>
                    {options.map((opt) => <option key={opt} value={opt}>{t(`electronics:repairs.condition.options.${opt}`)}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="form-group mb-0">
              <label className="form-label" htmlFor="conditionNotes">{t('electronics:repairs.form.conditionNotesLabel')}</label>
              <textarea id="conditionNotes" className="form-control" rows={2} {...register('conditionNotes')} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/repairs')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('electronics:repairs.form.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RepairIntakeForm;
