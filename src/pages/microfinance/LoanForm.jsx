import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import * as loanService from '../../services/loanService';
import * as loanProductService from '../../services/loanProductService';
import * as customerService from '../../services/customerService';
import * as branchService from '../../services/branchService';
import { useToast } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/formatCurrency';

function LoanForm() {
  const { t } = useTranslation(['microfinance', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const [borrowers, setBorrowers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [formError, setFormError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      customerId: '', loanProductId: '', branchId: '', requestedAmount: '', purpose: '',
      guarantors: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'guarantors' });
  const selectedProductId = watch('loanProductId');
  const selectedProduct = products.find((p) => String(p.id) === String(selectedProductId));

  useEffect(() => {
    customerService.listActiveCustomers().then(setBorrowers);
    loanProductService.listActiveLoanProducts().then(setProducts);
    branchService.listActiveBranches().then(setBranches);
  }, []);

  const onSubmit = async (values) => {
    setFormError('');
    const payload = {
      customerId: Number(values.customerId),
      loanProductId: Number(values.loanProductId),
      branchId: Number(values.branchId),
      requestedAmount: Number(values.requestedAmount),
      purpose: values.purpose || undefined,
      guarantors: (values.guarantors || [])
        .filter((g) => g.guarantorName)
        .map((g) => ({ guarantorName: g.guarantorName, guarantorPhone: g.guarantorPhone || undefined, guaranteedAmount: Number(g.guaranteedAmount) })),
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
        <div className="card mb-5">
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="customerId">{t('microfinance:loans.form.borrowerLabel')}</label>
                <select id="customerId" className={`form-control ${errors.customerId ? 'form-control-error' : ''}`} {...register('customerId', { required: t('microfinance:loans.form.borrowerRequired') })}>
                  <option value="">{t('microfinance:loans.form.selectBorrower')}</option>
                  {borrowers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
                {errors.customerId && <span className="form-error">{errors.customerId.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="branchId">{t('microfinance:loans.form.branchLabel')}</label>
                <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: t('microfinance:loans.form.branchRequired') })}>
                  <option value="">{t('microfinance:loans.form.selectBranch')}</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {errors.branchId && <span className="form-error">{errors.branchId.message}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="loanProductId">{t('microfinance:loans.form.loanProductLabel')}</label>
              <select id="loanProductId" className={`form-control ${errors.loanProductId ? 'form-control-error' : ''}`} {...register('loanProductId', { required: t('microfinance:loans.form.loanProductRequired') })}>
                <option value="">{t('microfinance:loans.form.selectLoanProduct')}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.loanProductId && <span className="form-error">{errors.loanProductId.message}</span>}
              {selectedProduct && (
                <span className="form-help">
                  {t('microfinance:loans.form.productRange', {
                    min: formatCurrency(selectedProduct.min_amount),
                    max: formatCurrency(selectedProduct.max_amount),
                    rate: selectedProduct.interest_rate,
                    method: t(`microfinance:loanProducts.form.${selectedProduct.interest_method}`),
                  })}
                </span>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="requestedAmount">{t('microfinance:loans.form.requestedAmountLabel')}</label>
                <input id="requestedAmount" type="number" min="0" step="0.01" className={`form-control ${errors.requestedAmount ? 'form-control-error' : ''}`} {...register('requestedAmount', { required: t('microfinance:loans.form.requestedAmountRequired') })} />
                {errors.requestedAmount && <span className="form-error">{errors.requestedAmount.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="purpose">{t('microfinance:loans.form.purposeLabel')}</label>
                <input id="purpose" className="form-control" {...register('purpose')} />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">{t('microfinance:loans.form.guarantorsTitle')}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => append({ guarantorName: '', guarantorPhone: '', guaranteedAmount: '' })}>
              <FiPlus aria-hidden="true" /> {t('microfinance:loans.form.addGuarantor')}
            </button>
          </div>
          {fields.length > 0 && (
            <div className="card-body">
              {fields.map((field, index) => (
                <div className="form-row" key={field.id} style={{ alignItems: 'flex-end' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor={`guarantors.${index}.guarantorName`}>{t('microfinance:loans.form.guarantorName')}</label>
                    <input id={`guarantors.${index}.guarantorName`} className="form-control" {...register(`guarantors.${index}.guarantorName`)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor={`guarantors.${index}.guarantorPhone`}>{t('microfinance:loans.form.guarantorPhone')}</label>
                    <input id={`guarantors.${index}.guarantorPhone`} className="form-control" {...register(`guarantors.${index}.guarantorPhone`)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor={`guarantors.${index}.guaranteedAmount`}>{t('microfinance:loans.form.guaranteedAmount')}</label>
                    <input id={`guarantors.${index}.guaranteedAmount`} type="number" min="0" step="0.01" className="form-control" {...register(`guarantors.${index}.guaranteedAmount`)} />
                  </div>
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(index)} aria-label={t('microfinance:loans.form.removeGuarantor')}>
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
          {t('microfinance:loans.form.submitApplication')}
        </button>
      </form>
    </div>
  );
}

export default LoanForm;
