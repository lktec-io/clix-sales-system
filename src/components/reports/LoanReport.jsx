import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiTrendingUp } from 'react-icons/fi';
import { ReportShell, ReportSection, ReportGrid, ReportTable, BarList } from './ReportShell';
import LoanCalculator from './LoanCalculator';
import ProgressBar from '../common/ProgressBar';
import * as loanService from '../../services/loanService';
import { useReportLoader } from '../../hooks/useReportLoader';
import { fetchAllPages, inRange, eachDay, toDayKey, presetRange, sum, percent } from '../../utils/reportData';
import { downloadCsv } from '../../utils/exportCsv';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import styles from './ModuleReports.module.css';

const LIVE = ['active', 'defaulted'];
const STATUS_ORDER = ['submitted', 'under_review', 'approved', 'disbursed', 'active', 'completed', 'defaulted', 'written_off', 'rejected'];
const STATUS_TONE = { active: undefined, completed: 'positive', defaulted: 'negative', written_off: 'negative', rejected: 'neutral' };

const outstandingOf = (loan) => (Number(loan.principal_outstanding) || 0) + (Number(loan.interest_outstanding) || 0);
const repaidFraction = (loan) => {
  const approved = Number(loan.approved_amount);
  if (!approved) return 0;
  if (loan.status === 'completed') return 1;
  return Math.max(0, Math.min(1, 1 - (Number(loan.principal_outstanding) || 0) / approved));
};

// Portfolio snapshot (all loans), disbursements and collections within the
// selected dates, plus the interest calculator.
function LoanReport() {
  const { t, i18n } = useTranslation(['reports', 'microfinance']);
  const navigate = useNavigate();
  const [range, setRange] = useState(() => presetRange('month'));
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';

  const loans = useReportLoader(
    () => fetchAllPages(({ page, limit }) => loanService.listLoans({ page, limit }), { maxPages: 30 }),
    [],
  );

  const repayments = useReportLoader(async () => {
    const { items, truncated } = await fetchAllPages(
      ({ page, limit }) => loanService.listRepayments({ page, limit }),
      { isBeforeRange: (row) => toDayKey(row.created_at) < range.from },
    );
    return { rows: items.filter((r) => inRange(r.payment_date || r.created_at, range.from, range.to)), truncated };
  }, [range.from, range.to]);

  const report = useMemo(() => {
    const all = loans.data?.items || [];
    const live = all.filter((l) => LIVE.includes(l.status));
    const disbursedInRange = all.filter((l) => l.disbursed_at && inRange(l.disbursed_at, range.from, range.to));
    const book = all.filter((l) => ['active', 'completed', 'defaulted', 'written_off'].includes(l.status));
    const approvedBook = sum(book, (l) => l.approved_amount);
    const principalOutstanding = sum(book.filter((l) => LIVE.includes(l.status)), (l) => l.principal_outstanding);
    const collections = repayments.data?.rows || [];

    return {
      all,
      live,
      outstanding: sum(live, outstandingOf),
      disbursedInRange,
      disbursedAmount: sum(disbursedInRange, (l) => l.approved_amount),
      collected: sum(collections, (r) => r.amount),
      collectionsCount: collections.length,
      repaidRate: percent(approvedBook - principalOutstanding - sum(book.filter((l) => l.status === 'written_off'), (l) => l.principal_outstanding), approvedBook),
      atRisk: all.filter((l) => l.status === 'defaulted' || l.status === 'written_off'),
      statusMix: STATUS_ORDER
        .map((status) => ({ label: t(`microfinance:loans.status.${status}`), value: all.filter((l) => l.status === status).length, tone: STATUS_TONE[status] }))
        .filter((s) => s.value > 0),
      collectionsDaily: eachDay(range.from, range.to).map((day) => {
        const dayRows = collections.filter((r) => toDayKey(r.payment_date || r.created_at) === day);
        return { key: day, day, payments: dayRows.length, amount: sum(dayRows, (r) => r.amount) };
      }).filter((d) => d.payments > 0),
      largestOutstanding: [...live].sort((a, b) => outstandingOf(b) - outstandingOf(a)).slice(0, 10),
    };
  }, [loans.data, repayments.data, range.from, range.to, t]);

  const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const formatDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' });
  const borrower = (l) => `${l.borrower_first_name || ''} ${l.borrower_last_name || ''}`.trim();
  const loanLink = (l) => <button type="button" className={styles.linkCell} onClick={() => navigate(`/loans/${l.id}`)}>{l.loan_number}</button>;

  const exportCsv = () => downloadCsv('loan-portfolio', report.all.map((l) => ({
    loan: l.loan_number,
    borrower: borrower(l),
    status: l.status,
    approved: l.approved_amount || '',
    interest_rate: l.interest_rate,
    disbursed_at: l.disbursed_at || '',
    principal_outstanding: l.principal_outstanding,
    interest_outstanding: l.interest_outstanding,
  })));

  return (
    <ReportShell
      title={t('reports:business.loans.title')}
      subtitle={t('reports:business.loans.subtitle')}
      icon={FiTrendingUp}
      range={range}
      onRangeChange={setRange}
      onRefresh={() => { loans.reload(); repayments.reload(); }}
      onExport={exportCsv}
      loading={loans.loading}
      error={loans.error || repayments.error}
      notice={loans.data?.truncated || repayments.data?.truncated ? t('reports:business.truncated') : null}
      stats={[
        { label: t('reports:business.loans.activeLoans'), value: formatNumber(report.live.length) },
        { label: t('reports:business.loans.outstanding'), value: formatCurrency(report.outstanding) },
        { label: t('reports:business.loans.disbursed'), value: formatCurrency(report.disbursedAmount), hint: t('reports:business.loans.loansCount', { count: report.disbursedInRange.length }) },
        { label: t('reports:business.loans.collected'), value: formatCurrency(report.collected), hint: t('reports:business.loans.paymentsCount', { count: report.collectionsCount }), tone: 'positive' },
        { label: t('reports:business.loans.principalRepaid'), value: `${report.repaidRate.toFixed(1)}%` },
        { label: t('reports:business.loans.atRisk'), value: formatNumber(report.atRisk.length), tone: report.atRisk.length ? 'negative' : undefined },
      ]}
    >
      <ReportGrid>
        <ReportSection title={t('reports:business.loans.statusMix')}>
          <BarList items={report.statusMix} formatValue={formatNumber} />
        </ReportSection>

        <ReportSection title={t('reports:business.loans.collectionsDaily')}>
          <ReportTable
            loading={repayments.loading}
            rows={report.collectionsDaily}
            emptyMessage={t('reports:business.loans.noCollections')}
            columns={[
              { key: 'day', label: t('reports:business.date'), render: (r) => formatDay(r.day) },
              { key: 'payments', label: t('reports:business.loans.payments'), numeric: true, render: (r) => formatNumber(r.payments) },
              { key: 'amount', label: t('reports:business.loans.collected'), numeric: true, render: (r) => formatCurrency(r.amount) },
            ]}
            footer={{ day: t('reports:business.total'), payments: formatNumber(report.collectionsCount), amount: formatCurrency(report.collected) }}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.loans.disbursements')} wide>
          <ReportTable
            loading={loans.loading}
            rows={report.disbursedInRange.map((l) => ({ ...l, key: l.id }))}
            emptyMessage={t('reports:business.loans.noDisbursements')}
            columns={[
              { key: 'loan_number', label: t('reports:business.loans.loan'), render: loanLink },
              { key: 'borrower', label: t('reports:business.loans.borrower'), render: borrower },
              { key: 'disbursed_at', label: t('reports:business.loans.disbursedOn'), render: (l) => <span className={styles.mono}>{formatDate(l.disbursed_at)}</span> },
              { key: 'interest_rate', label: t('microfinance:loans.detail.interestRate'), numeric: true, render: (l) => `${l.interest_rate}%` },
              { key: 'approved_amount', label: t('reports:business.loans.amount'), numeric: true, render: (l) => formatCurrency(l.approved_amount) },
              { key: 'repaid', label: t('reports:business.loans.repaid'), render: (l) => <ProgressBar size="sm" value={repaidFraction(l)} label={t('reports:business.loans.repaid')} /> },
            ]}
            footer={{ loan_number: t('reports:business.total'), approved_amount: formatCurrency(report.disbursedAmount) }}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.loans.largestOutstanding')} wide>
          <ReportTable
            loading={loans.loading}
            rows={report.largestOutstanding.map((l) => ({ ...l, key: l.id, rowClass: l.status === 'defaulted' ? 'row-danger' : undefined }))}
            columns={[
              { key: 'loan_number', label: t('reports:business.loans.loan'), render: loanLink },
              { key: 'borrower', label: t('reports:business.loans.borrower'), render: borrower },
              { key: 'status', label: t('reports:business.status'), render: (l) => <span className={`badge ${l.status === 'defaulted' ? 'badge-danger' : 'badge-success'}`}>{t(`microfinance:loans.status.${l.status}`)}</span> },
              { key: 'repaid', label: t('reports:business.loans.repaid'), render: (l) => <ProgressBar size="sm" value={repaidFraction(l)} label={t('reports:business.loans.repaid')} tone={l.status === 'defaulted' ? 'danger' : 'success'} /> },
              { key: 'outstanding', label: t('reports:business.loans.outstanding'), numeric: true, render: (l) => formatCurrency(outstandingOf(l)) },
            ]}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.loans.calculator')} wide>
          <LoanCalculator />
        </ReportSection>
      </ReportGrid>
    </ReportShell>
  );
}

export default LoanReport;
