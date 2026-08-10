import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiArrowDownCircle, FiArrowUpCircle } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import PageSkeleton from '../../components/common/PageSkeleton';
import EmptyState from '../../components/common/EmptyState';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as savingsService from '../../services/savingsService';
import * as branchService from '../../services/branchService';
import { formatCurrency } from '../../utils/formatCurrency';

function SavingsDetail() {
  const { t, i18n } = useTranslation(['microfinance', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canManage = usePermission('savings.manage');

  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [transactionType, setTransactionType] = useState(null);
  const [error, setError] = useState('');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: { branchId: '', amount: '', reference: '' } });

  const load = useCallback(() => {
    savingsService.getAccount(id).then(setAccount);
    savingsService.getAccountTransactions(id).then((result) => setTransactions(result.items));
  }, [id]);

  useEffect(() => {
    load();
    branchService.listActiveBranches().then(setBranches);
  }, [load]);

  if (!account) {
    return <PageSkeleton />;
  }

  const openTransaction = (type) => {
    reset({ branchId: '', amount: '', reference: '' });
    setError('');
    setTransactionType(type);
  };

  const onSubmit = async (values) => {
    setError('');
    try {
      await savingsService.recordTransaction(account.id, {
        branchId: Number(values.branchId), type: transactionType, amount: Number(values.amount), reference: values.reference || undefined,
      });
      toast.success(t('microfinance:savings.detail.transactionSuccess'));
      setTransactionType(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('microfinance:savings.detail.transactionError'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/savings')}>
            <FiArrowLeft aria-hidden="true" /> {t('microfinance:savings.detail.backToSavings')}
          </button>
          <h1 className="page-title">{account.account_number}</h1>
          <p className="page-subtitle">{account.customer_first_name} {account.customer_last_name}</p>
        </div>
        {canManage && account.status === 'active' && (
          <div className="page-actions">
            <button type="button" className="btn btn-secondary" onClick={() => openTransaction('withdrawal')}>
              <FiArrowUpCircle aria-hidden="true" /> {t('microfinance:savings.detail.withdraw')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openTransaction('deposit')}>
              <FiArrowDownCircle aria-hidden="true" /> {t('microfinance:savings.detail.deposit')}
            </button>
          </div>
        )}
      </div>

      <div className="card mb-5">
        <div className="card-body">
          <div className="form-row">
            <div>
              <span className="text-xs text-secondary">{t('microfinance:savings.detail.balance')}</span>
              <div className="text-sm font-semibold">{formatCurrency(account.balance)}</div>
            </div>
            <div>
              <span className="text-xs text-secondary">{t('microfinance:savings.detail.status')}</span>
              <div><span className={`badge ${account.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{account.status}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('microfinance:savings.detail.transactionsTitle')}</span></div>
        {transactions.length === 0 ? (
          <div className="card-body"><EmptyState title={t('microfinance:savings.detail.noTransactions')} /></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('microfinance:savings.detail.transactionColumns.date')}</th>
                  <th>{t('microfinance:savings.detail.transactionColumns.type')}</th>
                  <th>{t('microfinance:savings.detail.transactionColumns.amount')}</th>
                  <th>{t('microfinance:savings.detail.transactionColumns.balanceAfter')}</th>
                  <th>{t('microfinance:savings.detail.transactionColumns.reference')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDateTime(tx.created_at)}</td>
                    <td>
                      <span className={`badge ${tx.type === 'deposit' ? 'badge-success' : 'badge-warning'}`}>
                        {tx.type === 'deposit' ? t('microfinance:savings.detail.typeDeposit') : t('microfinance:savings.detail.typeWithdrawal')}
                      </span>
                    </td>
                    <td>{formatCurrency(tx.amount)}</td>
                    <td>{formatCurrency(tx.balance_after)}</td>
                    <td>{tx.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(transactionType)}
        onClose={() => setTransactionType(null)}
        title={transactionType === 'deposit' ? t('microfinance:savings.detail.depositModalTitle') : t('microfinance:savings.detail.withdrawModalTitle')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setTransactionType(null)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="savings-transaction-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {t('microfinance:savings.detail.submit')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="savings-transaction-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="branchId">{t('microfinance:savings.detail.branchLabel')}</label>
            <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: true })}>
              <option value="">{t('microfinance:savings.detail.selectBranch')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="amount">{t('microfinance:savings.detail.amountLabel')}</label>
            <input id="amount" type="number" min="0" step="0.01" className={`form-control ${errors.amount ? 'form-control-error' : ''}`} {...register('amount', { required: true })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reference">{t('microfinance:savings.detail.referenceLabel')}</label>
            <input id="reference" className="form-control" {...register('reference')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default SavingsDetail;
