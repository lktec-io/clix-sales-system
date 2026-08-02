import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiTrash2, FiDollarSign } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import KPICard from '../../components/dashboard/KPICard';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as expenseService from '../../services/expenseService';
import * as branchService from '../../services/branchService';
import { formatCurrency } from '../../utils/formatCurrency';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ExpenseList() {
  const { t, i18n } = useTranslation(['expenses', 'common']);
  const canCreate = usePermission('expenses.create');
  const canEdit = usePermission('expenses.edit');
  const canDelete = usePermission('expenses.delete');
  const toast = useToast();

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);

  const fetchExpenses = useCallback((params) => expenseService.listExpenses(params), []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters, refetch } = useTable(fetchExpenses);

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
  } = useForm({ defaultValues: { expenseCategoryId: '', branchId: '', amount: '', description: '', expenseDate: todayIso() } });

  useEffect(() => {
    expenseService.listExpenseCategories().then(setCategories);
    branchService.listActiveBranches().then(setBranches);
  }, []);

  const openCreate = () => {
    setEditing(null);
    reset({ expenseCategoryId: '', branchId: '', amount: '', description: '', expenseDate: todayIso() });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (expense) => {
    setEditing(expense);
    reset({
      expenseCategoryId: expense.expense_category_id,
      branchId: expense.branch_id,
      amount: expense.amount,
      description: expense.description || '',
      expenseDate: expense.expense_date,
    });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (values) => {
    setError('');
    const payload = {
      expenseCategoryId: Number(values.expenseCategoryId),
      branchId: Number(values.branchId),
      amount: Number(values.amount),
      description: values.description || undefined,
      expenseDate: values.expenseDate,
    };
    try {
      if (editing) {
        await expenseService.updateExpense(editing.id, payload);
        toast.success(t('expenses:list.updateSuccess'));
      } else {
        await expenseService.createExpense(payload);
        toast.success(t('expenses:list.createSuccess'));
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || t('expenses:list.saveError'));
    }
  };

  const handleDelete = async () => {
    setActionError('');
    try {
      await expenseService.deleteExpense(deleting.id);
      toast.success(t('expenses:list.deleteSuccess'));
      refetch();
    } catch (err) {
      setActionError(err.response?.data?.message || t('expenses:list.deleteError'));
    }
  };

  const columns = [
    { key: 'expense_date', label: t('expenses:columns.date'), render: (row) => formatDate(row.expense_date) },
    { key: 'category_name', label: t('expenses:columns.category') },
    { key: 'description', label: t('expenses:columns.description'), render: (row) => row.description || '—' },
    { key: 'branch_name', label: t('expenses:columns.branch') },
    { key: 'paid_by', label: t('expenses:columns.recordedBy'), render: (row) => (row.paid_by_first_name ? `${row.paid_by_first_name} ${row.paid_by_last_name}` : '—') },
    { key: 'amount', label: t('expenses:columns.amount'), render: (row) => formatCurrency(row.amount) },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          {canEdit && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(row)} aria-label={t('expenses:list.editExpense')}>
              <FiEdit2 />
            </button>
          )}
          {canDelete && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setDeleting(row)} aria-label={t('expenses:list.deleteExpense')}>
              <FiTrash2 />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('expenses:list.title')}</h1>
          <p className="page-subtitle">{t('expenses:list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus aria-hidden="true" /> {t('expenses:list.newExpense')}
            </button>
          </div>
        )}
      </div>

      <div className="mb-5">
        <KPICard icon={FiDollarSign} label={t('expenses:list.totalFiltered')} value={meta.totalAmount || 0} formatter={(v) => formatCurrency(v)} />
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('expenses:list.searchPlaceholder')} />
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="form-control"
              value={filters.categoryId || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value || undefined }))}
            >
              <option value="">{t('expenses:list.allCategories')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="form-control"
              value={filters.branchId || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value || undefined }))}
            >
              <option value="">{t('common:labels.allBranches')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input
              type="date"
              className="form-control"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))}
            />
            <input
              type="date"
              className="form-control"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))}
            />
          </div>
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('expenses:list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('expenses:list.editModalTitle') : t('expenses:list.newModalTitle')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="expense-form" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {editing ? t('common:actions.saveChanges') : t('expenses:list.recordExpense')}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
        <form id="expense-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="expenseCategoryId">{t('expenses:form.categoryLabel')}</label>
            <select id="expenseCategoryId" className={`form-control ${errors.expenseCategoryId ? 'form-control-error' : ''}`} {...register('expenseCategoryId', { required: t('expenses:form.categoryRequired') })}>
              <option value="">{t('expenses:form.selectCategory')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.expenseCategoryId && <span className="form-error">{errors.expenseCategoryId.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="branchId">{t('expenses:form.branchLabel')}</label>
            <select id="branchId" className={`form-control ${errors.branchId ? 'form-control-error' : ''}`} {...register('branchId', { required: t('expenses:form.branchRequired') })}>
              <option value="">{t('expenses:form.selectBranch')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {errors.branchId && <span className="form-error">{errors.branchId.message}</span>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="amount">{t('expenses:form.amountLabel')}</label>
              <input id="amount" type="number" min="0" step="0.01" className={`form-control ${errors.amount ? 'form-control-error' : ''}`} {...register('amount', { required: t('expenses:form.amountRequired'), min: { value: 0.01, message: t('expenses:form.amountPositive') } })} />
              {errors.amount && <span className="form-error">{errors.amount.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="expenseDate">{t('expenses:form.dateLabel')}</label>
              <input id="expenseDate" type="date" className={`form-control ${errors.expenseDate ? 'form-control-error' : ''}`} {...register('expenseDate', { required: t('expenses:form.dateRequired') })} />
              {errors.expenseDate && <span className="form-error">{errors.expenseDate.message}</span>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="description">{t('expenses:form.descriptionLabel')}</label>
            <input id="description" className="form-control" {...register('description')} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={t('expenses:list.deleteDialogTitle')}
        message={deleting ? t('expenses:list.deleteDialogMessage', { category: deleting.category_name, amount: formatCurrency(deleting.amount) }) : ''}
        confirmLabel={t('common:actions.delete')}
        variant="danger"
      />
    </div>
  );
}

export default ExpenseList;
