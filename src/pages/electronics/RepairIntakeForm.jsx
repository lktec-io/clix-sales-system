import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import * as repairService from '../../services/repairService';
import * as customerService from '../../services/customerService';
import * as branchService from '../../services/branchService';
import * as userService from '../../services/userService';
import { useToast } from '../../hooks/useToast';
import { splitFullName } from '../../utils/splitFullName';
import '../../styles/pages/RepairDetail.css';

const DEVICE_TYPES = ['smartphone', 'tablet', 'laptop', 'desktop', 'printer', 'other'];

// A predefined pick-list covering the brands an Electronics/Phone & Computer
// Service shop actually sees, with "Other" as an always-available escape
// hatch — a plain <select> rather than a new searchable-combobox dependency
// (native <select> already jump-searches by typing, and the list is short
// enough that this is sufficient without a new library). Model stays a
// free-text field per its own guidance: brand-specific model lists would
// need real relational data this app doesn't have, so a searchable/free
// field is the correct level of structure, not unnecessary complexity.
const BRAND_OPTIONS = [
  'Apple', 'Samsung', 'Tecno', 'Infinix', 'Xiaomi', 'Redmi', 'Huawei', 'Nokia',
  'Oppo', 'Vivo', 'OnePlus', 'Google', 'Itel', 'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Microsoft',
];

// Flat chip lists — matches device_condition/accessories_received's actual
// stored shape now ({ conditions: string[], notes }/string[]), validated
// server-side by the exact same allow-list in repair.validator.js. Faster
// to record than the previous per-component dropdowns (screen/body/back
// cover/camera/charging port/buttons/battery, one <select> each): a
// technician taps every chip that applies instead of setting 7 fields.
const CONDITION_OPTIONS = ['good', 'scratched', 'cracked_screen', 'broken_body', 'water_damage', 'no_power', 'missing_parts', 'other'];
const ACCESSORY_OPTIONS = ['charger', 'cable', 'sim_card', 'memory_card', 'case', 'bag', 'none', 'other'];

function RepairIntakeForm() {
  const { t } = useTranslation(['electronics', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerError, setQuickCustomerError] = useState('');
  const [savingQuickCustomer, setSavingQuickCustomer] = useState(false);

  const [selectedConditions, setSelectedConditions] = useState([]);
  const [selectedAccessories, setSelectedAccessories] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      customerId: '', branchId: '', technicianId: '', deviceType: 'smartphone',
      brand: '', brandOther: '', model: '', serialNumber: '', imei1: '', imei2: '', deviceColor: '',
      reportedProblem: '', estimatedCost: '', expectedCompletionAt: '',
      depositAmount: '', depositPaymentMethod: 'cash',
      conditionNotes: '',
    },
  });

  const depositAmount = watch('depositAmount');
  const brand = watch('brand');

  const toggleChip = (setter, key) => {
    setter((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
  };

  useEffect(() => {
    customerService.listActiveCustomers().then(setCustomers);
    userService.listUsers({ limit: 200 }).then((result) => setTechnicians(result.items || []));
    branchService.listActiveBranches().then((rows) => {
      setBranches(rows);
      if (rows.length === 1) setValue('branchId', rows[0].id);
    });
  }, [setValue]);

  const openQuickCustomer = () => {
    setQuickCustomerName('');
    setQuickCustomerPhone('');
    setQuickCustomerError('');
    setQuickCustomerOpen(true);
  };

  // Same shape as POS.jsx's Quick Add Customer — the one other place in the
  // app that already lets an operator create a customer inline without
  // leaving the screen they're on, reused here so a technician never has to
  // navigate away from Repair Intake to register a first-time customer.
  const submitQuickCustomer = async () => {
    setQuickCustomerError('');
    if (!quickCustomerName.trim() || !quickCustomerPhone.trim()) {
      setQuickCustomerError(t('electronics:repairs.form.quickCustomerRequired'));
      return;
    }
    setSavingQuickCustomer(true);
    try {
      const { firstName, lastName } = splitFullName(quickCustomerName);
      const created = await customerService.createCustomer({ firstName, lastName, phone: quickCustomerPhone.trim() });
      setCustomers((prev) => [...prev, created]);
      setValue('customerId', String(created.id), { shouldValidate: true });
      setQuickCustomerOpen(false);
      toast.success(t('electronics:repairs.form.quickCustomerAdded', { name: quickCustomerName.trim() }));
    } catch (err) {
      setQuickCustomerError(err.response?.data?.message || t('electronics:repairs.form.quickCustomerError'));
    } finally {
      setSavingQuickCustomer(false);
    }
  };

  const onSubmit = async (values) => {
    const resolvedBrand = values.brand === 'Other' ? values.brandOther?.trim() : values.brand;
    const payload = {
      customerId: Number(values.customerId),
      branchId: Number(values.branchId),
      technicianId: values.technicianId ? Number(values.technicianId) : undefined,
      deviceType: values.deviceType,
      brand: resolvedBrand,
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
      accessoriesReceived: selectedAccessories,
      deviceCondition: { conditions: selectedConditions, notes: values.conditionNotes?.trim() || undefined },
    };

    try {
      const repair = await repairService.createIntake(payload);
      toast.success(t('electronics:repairs.form.createSuccess', { number: repair.repair_number }));
      navigate(`/repairs/${repair.id}`, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || t('electronics:repairs.form.createError'));
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

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* SECTION A — Customer */}
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.form.customerSection')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <div className="flex items-center justify-between">
                  <label className="form-label form-label-required" htmlFor="customerId">{t('electronics:repairs.form.customerLabel')}</label>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={openQuickCustomer}>
                    <FiPlus aria-hidden="true" /> {t('electronics:repairs.form.newCustomer')}
                  </button>
                </div>
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
          </div>
        </div>

        {/* SECTION B — Device */}
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.form.deviceSection')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="deviceType">{t('electronics:repairs.form.deviceTypeLabel')}</label>
                <select id="deviceType" className="form-control" {...register('deviceType')}>
                  {DEVICE_TYPES.map((type) => <option key={type} value={type}>{t(`electronics:repairs.deviceTypes.${type}`)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="brand">{t('electronics:repairs.form.brandLabel')}</label>
                <select id="brand" className={`form-control ${errors.brand ? 'form-control-error' : ''}`} {...register('brand', { required: t('electronics:repairs.form.brandRequired') })}>
                  <option value="">{t('electronics:repairs.form.selectBrand')}</option>
                  {BRAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value="Other">{t('electronics:repairs.form.otherBrand')}</option>
                </select>
                {errors.brand && <span className="form-error">{errors.brand.message}</span>}
              </div>
              {brand === 'Other' && (
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="brandOther">{t('electronics:repairs.form.otherBrandLabel')}</label>
                  <input id="brandOther" className={`form-control ${errors.brandOther ? 'form-control-error' : ''}`} {...register('brandOther', { required: t('electronics:repairs.form.brandRequired') })} />
                  {errors.brandOther && <span className="form-error">{errors.brandOther.message}</span>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="model">{t('electronics:repairs.form.modelLabel')}</label>
                <input id="model" className={`form-control ${errors.model ? 'form-control-error' : ''}`} {...register('model', { required: t('electronics:repairs.form.modelRequired') })} placeholder={t('electronics:repairs.form.modelPlaceholder')} />
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
          </div>
        </div>

        {/* SECTION C — Device Condition (physical condition + accessories received) */}
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.form.conditionSection')}</span></div>
          <div className="card-body">
            <label className="form-label">{t('electronics:repairs.form.physicalConditionLabel')}</label>
            <div className="repair-chip-group mb-4">
              {CONDITION_OPTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`repair-chip ${selectedConditions.includes(key) ? 'repair-chip-active' : ''}`}
                  aria-pressed={selectedConditions.includes(key)}
                  onClick={() => toggleChip(setSelectedConditions, key)}
                >
                  {t(`electronics:repairs.condition.options.${key}`)}
                </button>
              ))}
            </div>

            <label className="form-label">{t('electronics:repairs.form.accessoriesSection')}</label>
            <div className="repair-chip-group mb-4">
              {ACCESSORY_OPTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`repair-chip ${selectedAccessories.includes(key) ? 'repair-chip-active' : ''}`}
                  aria-pressed={selectedAccessories.includes(key)}
                  onClick={() => toggleChip(setSelectedAccessories, key)}
                >
                  {t(`electronics:repairs.form.accessories.${key}`)}
                </button>
              ))}
            </div>

            <div className="form-group mb-0">
              <label className="form-label" htmlFor="conditionNotes">{t('electronics:repairs.form.conditionNotesLabel')}</label>
              <textarea id="conditionNotes" className="form-control" rows={2} {...register('conditionNotes')} />
            </div>
          </div>
        </div>

        {/* SECTION D — Customer's Complaint (kept separate from the technician's own diagnosis, which is recorded later) */}
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('electronics:repairs.form.problemSection')}</span></div>
          <div className="card-body">
            <div className="form-group mb-0">
              <label className="form-label form-label-required" htmlFor="reportedProblem">{t('electronics:repairs.form.reportedProblemLabel')}</label>
              <textarea id="reportedProblem" className={`form-control ${errors.reportedProblem ? 'form-control-error' : ''}`} rows={3} placeholder={t('electronics:repairs.form.reportedProblemPlaceholder')} {...register('reportedProblem', { required: t('electronics:repairs.form.reportedProblemRequired') })} />
              {errors.reportedProblem && <span className="form-error">{errors.reportedProblem.message}</span>}
            </div>
          </div>
        </div>

        {/* SECTION E — Estimated cost + deposit */}
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

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/repairs')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('electronics:repairs.form.submit')}
          </button>
        </div>
      </form>

      <Modal
        open={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        title={t('electronics:repairs.form.newCustomer')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setQuickCustomerOpen(false)}>{t('common:actions.cancel')}</button>
            <button
              type="button"
              className={`btn btn-primary ${savingQuickCustomer ? 'btn-loading' : ''}`}
              disabled={savingQuickCustomer}
              onClick={submitQuickCustomer}
            >
              {t('electronics:repairs.form.quickCustomerAddAndSelect')}
            </button>
          </>
        }
      >
        {quickCustomerError && <div className="alert alert-danger mb-4" role="alert">{quickCustomerError}</div>}
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="quick-customer-name">{t('electronics:repairs.form.quickCustomerName')}</label>
          <input id="quick-customer-name" className="form-control" value={quickCustomerName} onChange={(e) => setQuickCustomerName(e.target.value)} autoFocus />
        </div>
        <div className="form-group mb-0">
          <label className="form-label form-label-required" htmlFor="quick-customer-phone">{t('electronics:repairs.form.quickCustomerPhone')}</label>
          <input id="quick-customer-phone" className="form-control" value={quickCustomerPhone} onChange={(e) => setQuickCustomerPhone(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

export default RepairIntakeForm;
