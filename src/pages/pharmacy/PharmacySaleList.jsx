import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEye } from 'react-icons/fi';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchInput from '../../components/common/SearchInput';
import { useTable } from '../../hooks/useTable';
import { usePermission } from '../../hooks/usePermission';
import * as pharmacySaleService from '../../services/pharmacySaleService';
import { formatCurrency } from '../../utils/formatCurrency';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Monday-based week start, matching ReportsCenter.jsx's own startOfWeekIso()
// — the one other place in the app that already defines "this week".
function startOfWeekIso() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

const DATE_PRESETS = {
  today: () => [todayIso(), todayIso()],
  week: () => [startOfWeekIso(), todayIso()],
  month: () => [firstOfMonthIso(), todayIso()],
};

function PharmacySaleList() {
  const { t, i18n } = useTranslation(['pharmacy', 'common']);
  const navigate = useNavigate();
  const canCreate = usePermission('pharmacy_sales.create');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDate = (isoString) => new Date(isoString).toLocaleDateString(dateLocale, { dateStyle: 'medium' });

  // Sale history's date-range filter (Today/This Week/This Month/Custom) is
  // a real dateFrom/dateTo query param — pharmacySale.repository.js#findAll
  // filters on DATE(s.created_at) server-side, the same convention
  // expense.repository.js's own dateFrom/dateTo already uses — so this stays
  // correct under normal pagination instead of only ever showing whatever
  // fits in one fetched page. `period`/`customFrom`/`customTo` live in
  // useTable's `filters` purely so changing them resets to page 1 (its own
  // existing filtersKey-change effect) and to drive the controls below;
  // fetchSales translates them into the actual dateFrom/dateTo sent to the API.
  const fetchSales = useCallback((params) => {
    const { period, customFrom, customTo, ...rest } = params;
    let dateFrom;
    let dateTo;
    if (period === 'today' || period === 'week' || period === 'month') {
      [dateFrom, dateTo] = DATE_PRESETS[period]();
    } else if (period === 'custom') {
      dateFrom = customFrom || undefined;
      dateTo = customTo || undefined;
    }
    return pharmacySaleService.listSales({ ...rest, dateFrom, dateTo });
  }, []);
  const { items, meta, loading, page, setPage, search, setSearch, filters, setFilters } = useTable(fetchSales, {
    initialFilters: { period: 'all', customFrom: '', customTo: '' },
  });
  const { period, customFrom, customTo } = filters;

  const setPeriod = (value) => setFilters((prev) => ({ ...prev, period: value }));
  const setCustomFrom = (value) => setFilters((prev) => ({ ...prev, customFrom: value }));
  const setCustomTo = (value) => setFilters((prev) => ({ ...prev, customTo: value }));

  const columns = [
    { key: 'sale_number', label: t('pharmacy:sales.columns.saleNumber') },
    {
      key: 'customer',
      label: t('pharmacy:sales.columns.customer'),
      render: (row) => (row.customer_first_name ? `${row.customer_first_name} ${row.customer_last_name}` : t('pharmacy:sales.walkIn')),
    },
    { key: 'branch_name', label: t('pharmacy:sales.columns.branch') },
    { key: 'total_amount', label: t('pharmacy:sales.columns.total'), render: (row) => formatCurrency(row.total_amount) },
    { key: 'payment_method', label: t('pharmacy:sales.columns.paymentMethod'), render: (row) => t(`pharmacy:sales.paymentMethods.${row.payment_method}`) },
    { key: 'created_at', label: t('pharmacy:sales.columns.date'), render: (row) => formatDate(row.created_at) },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(`/pharmacy/sales/${row.id}`)} aria-label={t('pharmacy:sales.list.viewSale')}>
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
          <h1 className="page-title">{t('pharmacy:sales.list.title')}</h1>
          <p className="page-subtitle">{t('pharmacy:sales.list.subtitle')}</p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/pharmacy/sales/new')}>
              <FiPlus aria-hidden="true" /> {t('pharmacy:sales.list.newSale')}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder={t('pharmacy:sales.list.searchPlaceholder')} />
          <select
            className="form-control"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label={t('pharmacy:sales.dateFilter.quickRangeLabel')}
          >
            <option value="all">{t('pharmacy:sales.dateFilter.allTime')}</option>
            <option value="today">{t('pharmacy:sales.dateFilter.today')}</option>
            <option value="week">{t('pharmacy:sales.dateFilter.week')}</option>
            <option value="month">{t('pharmacy:sales.dateFilter.month')}</option>
            <option value="custom">{t('pharmacy:sales.dateFilter.custom')}</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                className="form-control"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label={t('pharmacy:sales.dateFilter.from')}
              />
              <input
                type="date"
                className="form-control"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label={t('pharmacy:sales.dateFilter.to')}
              />
            </>
          )}
        </div>
        <Table columns={columns} rows={items} loading={loading} emptyMessage={t('pharmacy:sales.list.emptyMessage')} />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default PharmacySaleList;
