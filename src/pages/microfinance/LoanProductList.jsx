import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiTrash2, FiPower } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as loanProductService from '../../services/loanProductService';
import { formatCurrency } from '../../utils/formatCurrency';

function LoanProductList() {
  const { t } = useTranslation(['microfinance', 'common']);
  const canManage = usePermission('loan_products.manage');
  const toast = useToast();

  const fetchProducts = useCallback((params) => loanProductService.listLoanProducts(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, refetch } = useTable(fetchProducts);

  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '', minAmount: '', maxAmount: '', interestRate: '', interestMethod: 'flat',
      durationValue: '', durationUnit: 'months', repaymentFrequency: 'monthly', processingFeePercent: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    reset({
      name: '', minAmount: '', maxAmount: '', interestRate: '', interestMethod: 'flat',
      durationValue: '', durationUnit: 'months', repaymentFrequency: 'monthly', processingFeePercent: '',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    reset({
      name: product.name, minAmount: product.min_amount, maxAmount: product.max_amount,
      interestRate: product.interest_rate, interestMethod: product.interest_method,
      durationValue: product.duration_value, durationUnit: product.duration_unit,
      repaymentFrequency: product.repayment_frequency, processingFeePercent: product.processing_fee_percent,
    });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    const payload = {
      name: values.name,
      minAmount: Number(values.minAmount),
      maxAmount: Number(values.maxAmount),
      interestRate: Number(values.interestRate),
      interestMethod: values.interestMethod,
      durationValue: Number(values.durationValue),
      durationUnit: values.durationUnit,
      repaymentFrequency: values.repaymentFrequency,
      processingFeePercent: values.processingFeePercent ? Number(values.processingFeePercent) : 0,
    };
    try {
      if (editing) {
        await loanProductService.updateLoanProduct(editing.id, payload);
        toast.success(t('microfinance:loanProducts.list.updateSuccess'));
      } else {
        await loanProductService.createLoanProduct(payload);
        toast.success(t('microfinance:loanProducts.list.createSuccess'));
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || t('microfinance:loanProducts.list.saveError'));
    }
  };

  const toggleStatus = async (product) => {
    setActionError('');
    try {
      await loanProductService.setLoanProductStatus(product.id, product.status === 'active' ? 'inactive' : 'active');
      toast.success(t('microfinance:loanProducts.list.statusUpdateSuccess'));
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || t('microfinance:loanProducts.list.statusUpdateError'));
    }
  };

  const handleDelete = async () => {
    setActionError('');
    try {
      await loanProductService.deleteLoanProduct(deleting.id);
      toast.success(t('microfinance:loanProducts.list.deleteSuccess'));
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || t('microfinance:loanProducts.list.deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  const columns = [
    { key: 'name', label: t('microfinance:loanProducts.columns.name') },
    { key: 'range', label: t('microfinance:loanProducts.columns.range'), render: (row) => `${formatCurrency(row.min_amount)} – ${formatCurrency(row.max_amount)}` },
    { key: 'interest_rate', label: t('microfinance:loanProducts.columns.interestRate'), render: (row) => `${row.interest_rate}%` },
    { key: 'interest_method', label: t('microfinance:loanProducts.columns.method'), render: (row) => t(`microfinance:loanProducts.form.${row.interest_method}`) },
    { key: 'duration', label: t('microfinance:loanProducts.columns.duration'), render: (row) => `${row.duration_value} ${t(`microfinance:loanProducts.form.${row.duration_unit}`)}` },
    { key: 'repayment_frequency', label: t('microfinance:loanProducts.columns.frequency'), render: (row) => t(`microfinance:loanProducts.form.${row.repayment_frequency}`) },
    {
      key: 'status',
      label: t('microfinance:loanProducts.columns.status'),
      render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{row.status}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          {canManage && (
            <>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label={t('microfinance:loanProducts.list.editProduct')}>
                <FiEdit2 />
              </button>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => toggleStatus(row)} aria-label={row.status === 'active' ? t('microfinance:loanProducts.list.deactivate') : t('microfinance:loanProducts.list.activate')}>
                <FiPower />
              </button>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setDeleting(row)} aria-label={t('microfinance:loanProducts.list.delete')}>
                <FiTrash2 />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('microfinance:loanProducts.list.title')}</h1>
          <p className="page-subtitle">{t('microfinance:loanProducts.list.subtitle')}</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('microfinance:loanProducts.list.newProduct')}
            </button>
          </div>
        )}
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('microfinance:loanProducts.list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('microfinance:loanProducts.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('microfinance:loanProducts.list.editModalTitle') : t('microfinance:loanProducts.list.newModalTitle')}
        size="md"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="loan-product-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {t('microfinance:loanProducts.list.save')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="loan-product-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="name">{t('microfinance:loanProducts.form.nameLabel')}</label>
            <input id="name" className={`form-control ${errors.name ? 'form-control-error' : ''}`} {...register('name', { required: t('microfinance:loanProducts.form.nameRequired') })} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="minAmount">{t('microfinance:loanProducts.form.minAmountLabel')}</label>
              <input id="minAmount" type="number" min="0" step="0.01" className={`form-control ${errors.minAmount ? 'form-control-error' : ''}`} {...register('minAmount', { required: t('microfinance:loanProducts.form.minAmountRequired') })} />
              {errors.minAmount && <span className="form-error">{errors.minAmount.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="maxAmount">{t('microfinance:loanProducts.form.maxAmountLabel')}</label>
              <input id="maxAmount" type="number" min="0" step="0.01" className={`form-control ${errors.maxAmount ? 'form-control-error' : ''}`} {...register('maxAmount', { required: t('microfinance:loanProducts.form.maxAmountRequired') })} />
              {errors.maxAmount && <span className="form-error">{errors.maxAmount.message}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="interestRate">{t('microfinance:loanProducts.form.interestRateLabel')}</label>
              <input id="interestRate" type="number" min="0" step="0.01" className={`form-control ${errors.interestRate ? 'form-control-error' : ''}`} {...register('interestRate', { required: t('microfinance:loanProducts.form.interestRateRequired') })} />
              {errors.interestRate && <span className="form-error">{errors.interestRate.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="interestMethod">{t('microfinance:loanProducts.form.interestMethodLabel')}</label>
              <select id="interestMethod" className="form-control" {...register('interestMethod')}>
                <option value="flat">{t('microfinance:loanProducts.form.flat')}</option>
                <option value="reducing">{t('microfinance:loanProducts.form.reducing')}</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="durationValue">{t('microfinance:loanProducts.form.durationValueLabel')}</label>
              <input id="durationValue" type="number" min="1" step="1" className={`form-control ${errors.durationValue ? 'form-control-error' : ''}`} {...register('durationValue', { required: t('microfinance:loanProducts.form.durationValueRequired') })} />
              {errors.durationValue && <span className="form-error">{errors.durationValue.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="durationUnit">{t('microfinance:loanProducts.form.durationUnitLabel')}</label>
              <select id="durationUnit" className="form-control" {...register('durationUnit')}>
                <option value="days">{t('microfinance:loanProducts.form.days')}</option>
                <option value="weeks">{t('microfinance:loanProducts.form.weeks')}</option>
                <option value="months">{t('microfinance:loanProducts.form.months')}</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="repaymentFrequency">{t('microfinance:loanProducts.form.repaymentFrequencyLabel')}</label>
              <select id="repaymentFrequency" className="form-control" {...register('repaymentFrequency')}>
                <option value="daily">{t('microfinance:loanProducts.form.daily')}</option>
                <option value="weekly">{t('microfinance:loanProducts.form.weekly')}</option>
                <option value="monthly">{t('microfinance:loanProducts.form.monthly')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="processingFeePercent">{t('microfinance:loanProducts.form.processingFeeLabel')}</label>
              <input id="processingFeePercent" type="number" min="0" step="0.01" className="form-control" {...register('processingFeePercent')} />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={t('microfinance:loanProducts.list.deleteDialogTitle')}
        message={deleting ? t('microfinance:loanProducts.list.deleteDialogMessage', { name: deleting.name }) : ''}
        confirmLabel={t('common:actions.delete')}
        variant="danger"
      />
    </div>
  );
}

export default LoanProductList;
