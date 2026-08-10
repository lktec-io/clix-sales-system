import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as savingsService from '../../services/savingsService';
import * as customerService from '../../services/customerService';
import { formatCurrency } from '../../utils/formatCurrency';

function SavingsList() {
  const { t } = useTranslation(['microfinance', 'common']);
  const navigate = useNavigate();
  const canManage = usePermission('savings.manage');
  const toast = useToast();
  const [customers, setCustomers] = useState([]);

  const fetchAccounts = useCallback((params) => savingsService.listAccounts(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, refetch } = useTable(fetchAccounts);

  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: { customerId: '' } });

  useEffect(() => {
    customerService.listActiveCustomers().then(setCustomers);
  }, []);

  const openCreate = () => {
    reset({ customerId: '' });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    try {
      const account = await savingsService.openAccount({ customerId: Number(values.customerId) });
      toast.success(t('microfinance:savings.list.openSuccess'));
      setModalOpen(false);
      refetch();
      navigate(`/savings/${account.id}`);
    } catch (err) {
      setError(err.response?.data?.message || t('microfinance:savings.list.openError'));
    }
  };

  const columns = [
    { key: 'account_number', label: t('microfinance:savings.columns.accountNumber') },
    { key: 'customer', label: t('microfinance:savings.columns.customer'), render: (row) => `${row.customer_first_name} ${row.customer_last_name}` },
    { key: 'balance', label: t('microfinance:savings.columns.balance'), render: (row) => formatCurrency(row.balance) },
    {
      key: 'status',
      label: t('microfinance:savings.columns.status'),
      render: (row) => <span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{row.status}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/savings/${row.id}`)} aria-label={t('microfinance:savings.list.viewAccount')}>
            <FiEye />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('microfinance:savings.list.title')}</h1>
          <p className="page-subtitle">{t('microfinance:savings.list.subtitle')}</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('microfinance:savings.list.newAccount')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('microfinance:savings.list.searchPlaceholder')} />
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('microfinance:savings.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('microfinance:savings.list.openModalTitle')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="savings-open-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {t('microfinance:savings.list.newAccount')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="savings-open-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="customerId">{t('microfinance:savings.list.customerLabel')}</label>
            <select id="customerId" className={`form-control ${errors.customerId ? 'form-control-error' : ''}`} {...register('customerId', { required: t('microfinance:savings.list.customerRequired') })}>
              <option value="">{t('microfinance:savings.list.selectCustomer')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
            {errors.customerId && <span className="form-error">{errors.customerId.message}</span>}
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default SavingsList;
