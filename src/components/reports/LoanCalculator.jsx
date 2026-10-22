import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatCurrency';
import styles from './ModuleReports.module.css';

// Mirrors backend/services/loan.service.js#generateScheduleInstallments so
// the estimate matches the schedule the system generates on disbursement.
const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };
const DURATION_UNIT_DAYS = { days: 1, weeks: 7, months: 30 };
const PERIODS_PER_YEAR = { daily: 365, weekly: 52, monthly: 12 };
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function buildSchedule({ principal, rate, method, durationValue, durationUnit, frequency }) {
  if (!(principal > 0) || !(durationValue > 0)) return [];
  const count = Math.max(1, Math.round((durationValue * DURATION_UNIT_DAYS[durationUnit]) / PERIOD_DAYS[frequency]));
  if (count > 1000) return [];
  const rows = [];

  if (method === 'reducing') {
    const periodic = (rate / 100) / PERIODS_PER_YEAR[frequency];
    const payment = periodic === 0 ? principal / count : (principal * periodic) / (1 - (1 + periodic) ** -count);
    let remaining = principal;
    for (let i = 1; i <= count; i += 1) {
      const interest = round2(remaining * periodic);
      let principalDue = round2(payment - interest);
      if (i === count) principalDue = round2(remaining);
      remaining = round2(remaining - principalDue);
      rows.push({ n: i, principal: principalDue, interest, total: round2(principalDue + interest), balance: Math.max(0, remaining) });
    }
  } else {
    const totalInterest = round2(principal * (rate / 100));
    const basePrincipal = round2(principal / count);
    const baseInterest = round2(totalInterest / count);
    let allocatedP = 0;
    let allocatedI = 0;
    for (let i = 1; i <= count; i += 1) {
      const last = i === count;
      const principalDue = last ? round2(principal - allocatedP) : basePrincipal;
      const interest = last ? round2(totalInterest - allocatedI) : baseInterest;
      allocatedP = round2(allocatedP + principalDue);
      allocatedI = round2(allocatedI + interest);
      rows.push({ n: i, principal: principalDue, interest, total: round2(principalDue + interest), balance: round2(principal - allocatedP) });
    }
  }
  return rows;
}

// Interest calculator: enter terms, see the installment schedule and totals.
function LoanCalculator() {
  const { t } = useTranslation(['reports', 'microfinance']);
  const [form, setForm] = useState({ principal: '1000000', rate: '20', method: 'flat', durationValue: '6', durationUnit: 'months', frequency: 'monthly' });
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const schedule = useMemo(() => buildSchedule({
    principal: Number(form.principal),
    rate: Number(form.rate) || 0,
    method: form.method,
    durationValue: Number(form.durationValue),
    durationUnit: form.durationUnit,
    frequency: form.frequency,
  }), [form]);

  const totalInterest = schedule.reduce((a, r) => a + r.interest, 0);
  const totalPayable = schedule.reduce((a, r) => a + r.total, 0);

  return (
    <div className={styles.calculator}>
      <div className={styles.calcForm}>
        <label>
          {t('reports:business.loans.calc.principal')}
          <input className="form-control" type="number" min="0" step="1000" value={form.principal} onChange={set('principal')} />
        </label>
        <label>
          {t('reports:business.loans.calc.rate')}
          <input className="form-control" type="number" min="0" step="0.5" value={form.rate} onChange={set('rate')} />
        </label>
        <label>
          {t('reports:business.loans.calc.method')}
          <select className="form-control" value={form.method} onChange={set('method')}>
            <option value="flat">{t('reports:business.loans.calc.flat')}</option>
            <option value="reducing">{t('reports:business.loans.calc.reducing')}</option>
          </select>
        </label>
        <label>
          {t('reports:business.loans.calc.frequency')}
          <select className="form-control" value={form.frequency} onChange={set('frequency')}>
            <option value="daily">{t('microfinance:loanProducts.form.daily')}</option>
            <option value="weekly">{t('microfinance:loanProducts.form.weekly')}</option>
            <option value="monthly">{t('microfinance:loanProducts.form.monthly')}</option>
          </select>
        </label>
        <label>
          {t('reports:business.loans.calc.duration')}
          <input className="form-control" type="number" min="1" step="1" value={form.durationValue} onChange={set('durationValue')} />
        </label>
        <label>
          {t('reports:business.loans.calc.unit')}
          <select className="form-control" value={form.durationUnit} onChange={set('durationUnit')}>
            <option value="days">{t('microfinance:loanProducts.form.days')}</option>
            <option value="weeks">{t('microfinance:loanProducts.form.weeks')}</option>
            <option value="months">{t('microfinance:loanProducts.form.months')}</option>
          </select>
        </label>
        <p className={styles.calcNote}>{t('reports:business.loans.calc.note')}</p>
      </div>

      <div className={styles.calcResult}>
        <div className={styles.calcTotals}>
          <div className={styles.calcTotal}><span>{t('reports:business.loans.calc.installments')}</span><strong>{schedule.length}</strong></div>
          <div className={styles.calcTotal}><span>{t('reports:business.loans.calc.totalInterest')}</span><strong>{formatCurrency(totalInterest)}</strong></div>
          <div className={styles.calcTotal}><span>{t('reports:business.loans.calc.totalPayable')}</span><strong>{formatCurrency(totalPayable)}</strong></div>
        </div>
        <div className={`table-wrapper ${styles.calcTable}`}>
          <table className="table">
            <thead>
              <tr>
                <th className="cell-num">#</th>
                <th className="cell-num">{t('microfinance:loans.detail.scheduleColumns.principal')}</th>
                <th className="cell-num">{t('microfinance:loans.detail.scheduleColumns.interest')}</th>
                <th className="cell-num">{t('microfinance:loans.detail.scheduleColumns.total')}</th>
                <th className="cell-num">{t('microfinance:loans.detail.scheduleColumns.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.n}>
                  <td className="cell-num">{row.n}</td>
                  <td className="cell-num">{formatCurrency(row.principal)}</td>
                  <td className="cell-num">{formatCurrency(row.interest)}</td>
                  <td className="cell-num">{formatCurrency(row.total)}</td>
                  <td className="cell-num">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LoanCalculator;
