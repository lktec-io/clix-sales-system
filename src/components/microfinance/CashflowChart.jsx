import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BarChart from '../charts/BarChart';
import { eachDay, inRange, toDayKey } from '../../utils/reportData';
import { formatCurrency } from '../../utils/formatCurrency';
import styles from './Microfinance.module.css';

const EXPECTED_COLOR = '#0D9488';
const ACTUAL_COLOR = '#2563EB';

// Expected collections (installments falling due) vs repayments actually
// received, per day, across the window.
function CashflowChart({ loans, payments, from, to, height = 260 }) {
  const { t, i18n } = useTranslation('microfinance');
  const locale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';

  const series = useMemo(() => {
    const days = eachDay(from, to);
    const expected = Object.fromEntries(days.map((d) => [d, 0]));
    const actual = Object.fromEntries(days.map((d) => [d, 0]));
    loans.forEach((loan) => (loan.schedule || []).forEach((row) => {
      const key = toDayKey(row.due_date);
      if (key in expected) expected[key] += Number(row.total_due) || 0;
    }));
    payments.forEach((p) => {
      if (inRange(p.payment_date || p.created_at, from, to)) actual[toDayKey(p.payment_date || p.created_at)] += Number(p.amount) || 0;
    });
    const expectedTotal = days.reduce((a, d) => a + expected[d], 0);
    const actualTotal = days.reduce((a, d) => a + actual[d], 0);
    return { days, expected, actual, expectedTotal, actualTotal };
  }, [loans, payments, from, to]);

  const rate = series.expectedTotal ? (series.actualTotal / series.expectedTotal) * 100 : 0;
  const label = (day) => new Date(`${day}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div className={styles.cashflow}>
      <div className={styles.cashflowStats}>
        <div><span>{t('fintech.cashflow.expected')}</span><strong style={{ color: EXPECTED_COLOR }}>{formatCurrency(series.expectedTotal)}</strong></div>
        <div><span>{t('fintech.cashflow.actual')}</span><strong style={{ color: ACTUAL_COLOR }}>{formatCurrency(series.actualTotal)}</strong></div>
        <div><span>{t('fintech.cashflow.rate')}</span><strong>{rate.toFixed(1)}%</strong></div>
      </div>
      <BarChart
        labels={series.days.map(label)}
        datasets={[
          { label: t('fintech.cashflow.expected'), values: series.days.map((d) => series.expected[d]), color: EXPECTED_COLOR },
          { label: t('fintech.cashflow.actual'), values: series.days.map((d) => series.actual[d]), color: ACTUAL_COLOR },
        ]}
        valueFormatter={formatCurrency}
        height={height}
      />
    </div>
  );
}

export default CashflowChart;
