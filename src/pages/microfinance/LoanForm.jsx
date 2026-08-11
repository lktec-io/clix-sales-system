import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as loanService from '../../services/loanService';
import * as customerService from '../../services/customerService';
import * as branchService from '../../services/branchService';
import { useToast } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/formatCurrency';
import '../../styles/pages/LoanForm.css';

// Mirrors loan.service.js's own DURATION_UNIT_TO_FREQUENCY exactly — the
// live summary shown here must always agree with what the backend actually
// computes, so this is the same mapping, not a re-guess.
const DURATION_UNIT_TO_FREQUENCY = { days: 'daily', weeks: 'weekly', months: 'monthly' };

function LoanForm() {
  const { t } = useTranslation(['microfinance', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const [borrowers, setBorrowers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      customerId: '', branchId: '', requestedAmount: '', interestRate: '',
      durationValue: '', durationUnit: 'months', startDate: '', purpose: '',
    },
  });

  useEffect(() => {
    customerService.listActiveCustomers().then(setBorrowers);
    branchService.listActiveBranches().then((rows) => {
      setBranches(rows);
      // A single-branch tenant (the common case for a new Microfinance
      // business) never needs to be asked which branch — auto-select it so
      // the form only shows a branch picker when there's an actual choice.
      if (rows.length === 1) setValue('branchId', rows[0].id);
    });
  }, [setValue]);

  const amount = Number(watch('requestedAmount')) || 0;
  const rate = Number(watch('interestRate')) || 0;
  const durationValue = Number(watch('durationValue')) || 0;
  const durationUnit = watch('durationUnit');

  // Flat-rate preview only — the simplified Create Loan form always uses
  // flat interest (loan.service.js#applyForLoan defaults interestMethod to
  // 'flat' whenever no Loan Product is supplied), so this is the exact same
  // math the backend will apply, not an approximation.
  const totalInterest = useMemo(() => Math.round((amount * (rate / 100)) * 100) / 100, [amount, rate]);
  const totalPayable = useMemo(() => Math.round((amount + totalInterest) * 100) / 100, [amount, totalInterest]);
  const repaymentFrequency = DURATION_UNIT_TO_FREQUENCY[durationUnit] || '—';

  const onSubmit = async (values) => {
    setFormError('');
    const payload = {
      customerId: Number(values.customerId),
      branchId: Number(values.branchId),
      requestedAmount: Number(values.requestedAmount),
      interestRate: Number(values.interestRate),
      durationValue: Number(values.durationValue),
      durationUnit: values.durationUnit,
      startDate: values.startDate || undefined,
      purpose: values.purpose || undefined,
    };

    try {
      const loan = await loanService.applyForLoan(payload);
      toast.success(t('microfinance:loans.form.createSuccess'));
      navigate(`/loans/${loan.id}`, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('microfinance:loans.form.createError'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('microfinance:loans.form.newTitle')}</h1>
          <p className="page-subtitle">{t('microfinance:loans.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="loan-form-layout">
          <div className="card">
            <div className="card-body">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="customerId">{t('microfinance:loans.form.borrowerLabel')}</label>
                <select id="customerId" className={`form-control ${errors.customerId ? 'form-control-error' : ''}`} {...register('customerId', { required: t('microfinance:loans.form.borrowerRequired') })}>
                  <option value="">{t('microfinance:loans.form.selectBorrower')}</option>
                  {borrowers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
                {errors.customerId && <span className="form-error">{errors.customerId.message}</span>}
              </div>

              {branches.length > 1 && (
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="branchId">{t('microfinance:loans.form.branchLabel')}</label>
                  <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: t('microfinance:loans.form.branchRequired') })}>
                    <option value="">{t('microfinance:loans.form.selectBranch')}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {errors.branchId && <span className="form-error">{errors.branchId.message}</span>}
                </div>
              )}

              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="requestedAmount">{t('microfinance:loans.form.loanAmountLabel')}</label>
                <input id="requestedAmount" type="number" min="0" step="0.01" className={`form-control ${errors.requestedAmount ? 'form-control-error' : ''}`} {...register('requestedAmount', { required: t('microfinance:loans.form.requestedAmountRequired') })} />
                {errors.requestedAmount && <span className="form-error">{errors.requestedAmount.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="interestRate">{t('microfinance:loans.form.interestRateLabel')}</label>
                <input id="interestRate" type="number" min="0" step="0.01" className={`form-control ${errors.interestRate ? 'form-control-error' : ''}`} {...register('interestRate', { required: t('microfinance:loans.form.interestRateRequired') })} />
                {errors.interestRate && <span className="form-error">{errors.interestRate.message}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="durationValue">{t('microfinance:loans.form.durationLabel')}</label>
                  <input id="durationValue" type="number" min="1" step="1" className={`form-control ${errors.durationValue ? 'form-control-error' : ''}`} {...register('durationValue', { required: t('microfinance:loans.form.durationRequired') })} />
                  {errors.durationValue && <span className="form-error">{errors.durationValue.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="durationUnit">{t('microfinance:loans.form.unitLabel')}</label>
                  <select id="durationUnit" className="form-control" {...register('durationUnit')}>
                    <option value="days">{t('microfinance:loanProducts.form.days')}</option>
                    <option value="weeks">{t('microfinance:loanProducts.form.weeks')}</option>
                    <option value="months">{t('microfinance:loanProducts.form.months')}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="startDate">{t('microfinance:loans.form.startDateLabel')}</label>
                <input id="startDate" type="date" className="form-control" {...register('startDate')} />
              </div>

              <div className="form-group mb-0">
                <label className="form-label" htmlFor="purpose">{t('microfinance:loans.form.purposeLabel')}</label>
                <textarea id="purpose" className="form-control" rows={3} {...register('purpose')} />
              </div>
            </div>
          </div>

          <div className="card loan-summary-card">
            <div className="card-header"><span className="card-title">{t('microfinance:loans.form.summaryTitle')}</span></div>
            <div className="card-body loan-summary-body">
              <div className="loan-summary-row">
                <span>{t('microfinance:loans.form.loanAmountLabel')}</span>
                <strong>{formatCurrency(amount)}</strong>
              </div>
              <div className="loan-summary-row">
                <span>{t('microfinance:loans.form.interestRateLabel')}</span>
                <strong>{rate}%</strong>
              </div>
              <div className="loan-summary-row">
                <span>{t('microfinance:loans.form.durationLabel')}</span>
                <strong>{durationValue || 0} {t(`microfinance:loanProducts.form.${durationUnit}`)}</strong>
              </div>
              <div className="loan-summary-row">
                <span>{t('microfinance:loans.form.repaymentFrequencyLabel')}</span>
                <strong>{t(`microfinance:loanProducts.form.${repaymentFrequency}`, repaymentFrequency)}</strong>
              </div>
              <div className="loan-summary-divider" />
              <div className="loan-summary-row">
                <span>{t('microfinance:loans.form.totalInterestLabel')}</span>
                <strong>{formatCurrency(totalInterest)}</strong>
              </div>
              <div className="loan-summary-row loan-summary-total">
                <span>{t('microfinance:loans.form.totalPayableLabel')}</span>
                <strong>{formatCurrency(totalPayable)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="loan-form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/loans')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {t('microfinance:loans.form.submitApplication')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default LoanForm;
