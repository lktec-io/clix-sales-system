import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiPlus } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as loanService from '../../services/loanService';
import { formatCurrency } from '../../utils/formatCurrency';

function RepaymentList() {
  const { t, i18n } = useTranslation(['microfinance', 'common']);
  const canRecord = usePermission('loan_repayments.create');
  const toast = useToast();
  const [activeLoans, setActiveLoans] = useState([]);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  const fetchRepayments = useCallback((params) => loanService.listRepayments(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, refetch } = useTable(fetchRepayments);

  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { loanId: '', amount: '', paymentMethod: 'cash', paymentDate: new Date().toISOString().slice(0, 10), reference: '' },
  });

  useEffect(() => {
    if (modalOpen) {
      loanService.listLoans({ status: 'active', limit: 200 }).then((result) => setActiveLoans(result.items));
    }
  }, [modalOpen]);

  const openCreate = () => {
    reset({ loanId: '', amount: '', paymentMethod: 'cash', paymentDate: new Date().toISOString().slice(0, 10), reference: '' });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    try {
      await loanService.recordRepayment({
        loanId: Number(values.loanId), amount: Number(values.amount), paymentMethod: values.paymentMethod,
        paymentDate: values.paymentDate, reference: values.reference || undefined,
      });
      toast.success(t('microfinance:loans.detail.recordSuccess'));
      setModalOpen(false);
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || t('microfinance:loans.detail.recordError'));
    }
  };

  const columns = [
    { key: 'receipt_number', label: t('microfinance:loans.detail.receiptNumber'), render: (row) => row.receipt_number },
    { key: 'loan_number', label: t('microfinance:loans.columns.loanNumber') },
    { key: 'borrower', label: t('microfinance:loans.columns.borrower'), render: (row) => `${row.borrower_first_name} ${row.borrower_last_name}` },
    { key: 'amount', label: t('microfinance:loans.detail.repaymentAmountLabel'), render: (row) => formatCurrency(row.amount) },
    { key: 'payment_method', label: t('microfinance:loans.detail.paymentMethodLabel'), render: (row) => t(`microfinance:loans.paymentMethods.${row.payment_method}`) },
    { key: 'payment_date', label: t('common:labels.date'), render: (row) => formatDate(row.payment_date) },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('microfinance:loans.detail.repaymentsTitle')}</h1>
          <p className="page-subtitle">{t('microfinance:loans.list.subtitle')}</p>
        </div>
        {canRecord && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('microfinance:loans.detail.recordRepayment')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('microfinance:loans.list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('microfinance:loans.detail.noRepayments')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('microfinance:loans.detail.recordRepayment')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="repayment-list-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {t('microfinance:loans.detail.recordRepayment')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="repayment-list-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="loanId">{t('microfinance:loans.columns.loanNumber')}</label>
            <select id="loanId" className={`form-control ${errors.loanId ? 'form-control-error' : ''}`} {...register('loanId', { required: true })}>
              <option value="">{t('microfinance:loans.detail.selectLoan')}</option>
              {activeLoans.map((loan) => (
                <option key={loan.id} value={loan.id}>{loan.loan_number} — {loan.borrower_first_name} {loan.borrower_last_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="amount">{t('microfinance:loans.detail.repaymentAmountLabel')}</label>
            <input id="amount" type="number" min="0" step="0.01" className={`form-control ${errors.amount ? 'form-control-error' : ''}`} {...register('amount', { required: true })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="paymentMethod">{t('microfinance:loans.detail.paymentMethodLabel')}</label>
            <select id="paymentMethod" className="form-control" {...register('paymentMethod')}>
              <option value="cash">{t('microfinance:loans.paymentMethods.cash')}</option>
              <option value="mobile_money">{t('microfinance:loans.paymentMethods.mobile_money')}</option>
              <option value="bank_transfer">{t('microfinance:loans.paymentMethods.bank_transfer')}</option>
              <option value="cheque">{t('microfinance:loans.paymentMethods.cheque')}</option>
              <option value="other">{t('microfinance:loans.paymentMethods.other')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="paymentDate">{t('microfinance:loans.detail.paymentDateLabel')}</label>
            <input id="paymentDate" type="date" className="form-control" {...register('paymentDate', { required: true })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reference">{t('microfinance:loans.detail.referenceLabel')}</label>
            <input id="reference" className="form-control" {...register('reference')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default RepaymentList;
