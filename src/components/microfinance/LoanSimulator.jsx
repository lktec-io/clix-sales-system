import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPrinter } from 'react-icons/fi';
import { buildSchedule, toSystemRate } from '../../utils/loanMath';
import { toDayKey } from '../../utils/reportData';
import { formatCurrency } from '../../utils/formatCurrency';
import { escapeHtml, printDocument } from '../../utils/printDocument';
import styles from './Microfinance.module.css';

const RATE_LIMITS = { monthly: { max: 15, step: 0.1 }, annual: { max: 120, step: 0.5 } };
const TENURE_LIMITS = { weeks: 104, months: 60 };

// Slider + exact-value box kept in sync; both are 44px touch targets.
function SliderField({ label, value, min, max, step, onChange, display }) {
  const id = useId();
  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className={styles.sliderValue}>{display}</output>
      </div>
      <div className={styles.sliderRow}>
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <input
          type="number"
          className={`form-control ${styles.sliderBox}`}
          min={min}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>
    </div>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Interactive loan simulator: sliders for principal, rate and tenure, instant
// totals and a dated, printable amortization schedule.
function LoanSimulator() {
  const { t, i18n } = useTranslation(['microfinance', 'common']);
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const [form, setForm] = useState({
    principal: 1000000, rate: 3, basis: 'monthly', method: 'flat',
    tenure: 6, tenureUnit: 'months', frequency: 'monthly', startDate: toDayKey(new Date()),
  });
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setBasis = (basis) => setForm((prev) => ({
    ...prev,
    basis,
    rate: Math.min(RATE_LIMITS[basis].max, basis === 'annual' ? prev.rate * 12 : Math.round((prev.rate / 12) * 10) / 10),
  }));
  const setTenureUnit = (tenureUnit) => setForm((prev) => ({
    ...prev,
    tenureUnit,
    tenure: Math.min(TENURE_LIMITS[tenureUnit], tenureUnit === 'weeks' ? prev.tenure * 4 : Math.max(1, Math.round(prev.tenure / 4))),
    frequency: tenureUnit === 'weeks' && prev.frequency === 'monthly' ? 'weekly' : prev.frequency,
  }));

  const systemRate = toSystemRate({ rate: form.rate, basis: form.basis, method: form.method, durationValue: form.tenure, durationUnit: form.tenureUnit });
  const schedule = useMemo(() => buildSchedule({
    principal: form.principal,
    rate: systemRate,
    method: form.method,
    durationValue: form.tenure,
    durationUnit: form.tenureUnit,
    frequency: form.frequency,
    startDate: form.startDate || toDayKey(new Date()),
  }), [form, systemRate]);

  const totalInterest = schedule.reduce((a, r) => a + r.interest, 0);
  const totalRepayment = schedule.reduce((a, r) => a + r.total, 0);
  const installment = schedule[0]?.total || 0;
  const interestShare = totalRepayment ? (totalInterest / totalRepayment) * 100 : 0;
  const formatDate = (key) => (key ? new Date(`${key}T00:00:00`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const frequencyLabel = t(`microfinance:loanProducts.form.${form.frequency}`);

  const printSchedule = () => {
    const rows = schedule.map((r) => `<tr><td>${r.n}</td><td>${escapeHtml(formatDate(r.dueDate))}</td><td class="num">${escapeHtml(formatCurrency(r.principal))}</td><td class="num">${escapeHtml(formatCurrency(r.interest))}</td><td class="num">${escapeHtml(formatCurrency(r.total))}</td><td class="num">${escapeHtml(formatCurrency(r.balance))}</td></tr>`).join('');
    printDocument(t('microfinance:fintech.calc.scheduleTitle'), `
      <h1>${escapeHtml(t('microfinance:fintech.calc.scheduleTitle'))}</h1>
      <p class="muted">${escapeHtml(t('microfinance:fintech.calc.printSummary', {
        principal: formatCurrency(form.principal), rate: systemRate.toFixed(2), method: t(`microfinance:loanProducts.form.${form.method}`),
        count: schedule.length, frequency: frequencyLabel,
      }))}</p>
      <table><thead><tr><th>#</th><th>${escapeHtml(t('microfinance:loans.detail.scheduleColumns.dueDate'))}</th><th class="num">${escapeHtml(t('microfinance:loans.detail.scheduleColumns.principal'))}</th><th class="num">${escapeHtml(t('microfinance:loans.detail.scheduleColumns.interest'))}</th><th class="num">${escapeHtml(t('microfinance:fintech.calc.installment'))}</th><th class="num">${escapeHtml(t('microfinance:loans.detail.scheduleColumns.balance'))}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total">${escapeHtml(t('microfinance:fintech.calc.totalRepayment'))}: <span class="mono">${escapeHtml(formatCurrency(totalRepayment))}</span></div>
    `);
  };

  return (
    <div className={styles.simulator}>
      <div className={styles.simControls}>
        <SliderField
          label={t('microfinance:fintech.calc.principal')}
          value={form.principal} min={50000} max={50000000} step={50000}
          onChange={set('principal')} display={formatCurrency(form.principal)}
        />

        <div className={styles.controlGroup}>
          <Segmented
            label={t('microfinance:fintech.calc.rateBasis')}
            value={form.basis}
            onChange={setBasis}
            options={[{ value: 'monthly', label: t('microfinance:fintech.calc.perMonth') }, { value: 'annual', label: t('microfinance:fintech.calc.perAnnum') }]}
          />
          <SliderField
            label={t('microfinance:fintech.calc.rate')}
            value={form.rate} min={0} max={RATE_LIMITS[form.basis].max} step={RATE_LIMITS[form.basis].step}
            onChange={set('rate')} display={`${form.rate}%`}
          />
        </div>

        <div className={styles.controlGroup}>
          <Segmented
            label={t('microfinance:fintech.calc.tenureUnit')}
            value={form.tenureUnit}
            onChange={setTenureUnit}
            options={[{ value: 'weeks', label: t('microfinance:loanProducts.form.weeks') }, { value: 'months', label: t('microfinance:loanProducts.form.months') }]}
          />
          <SliderField
            label={t('microfinance:fintech.calc.tenure')}
            value={form.tenure} min={1} max={TENURE_LIMITS[form.tenureUnit]} step={1}
            onChange={set('tenure')} display={`${form.tenure} ${t(`microfinance:loanProducts.form.${form.tenureUnit}`)}`}
          />
        </div>

        <div className={styles.selectRow}>
          <label>
            {t('microfinance:loanProducts.form.interestMethodLabel')}
            <select className="form-control" value={form.method} onChange={(e) => set('method')(e.target.value)}>
              <option value="flat">{t('microfinance:loanProducts.form.flat')}</option>
              <option value="reducing">{t('microfinance:loanProducts.form.reducing')}</option>
            </select>
          </label>
          <label>
            {t('microfinance:fintech.calc.frequency')}
            <select className="form-control" value={form.frequency} onChange={(e) => set('frequency')(e.target.value)}>
              <option value="daily">{t('microfinance:loanProducts.form.daily')}</option>
              <option value="weekly">{t('microfinance:loanProducts.form.weekly')}</option>
              <option value="monthly">{t('microfinance:loanProducts.form.monthly')}</option>
            </select>
          </label>
          <label>
            {t('microfinance:fintech.calc.startDate')}
            <input type="date" className="form-control" value={form.startDate} onChange={(e) => set('startDate')(e.target.value)} />
          </label>
        </div>
      </div>

      <div className={styles.simResult}>
        <div className={styles.figures}>
          <div className={styles.figureHero}>
            <span>{t('microfinance:fintech.calc.perInstallment', { frequency: frequencyLabel.toLowerCase() })}</span>
            <strong>{formatCurrency(installment)}</strong>
            <small>{t('microfinance:fintech.calc.installmentsCount', { count: schedule.length })}</small>
          </div>
          <div className={styles.figure}><span>{t('microfinance:fintech.calc.totalInterest')}</span><strong>{formatCurrency(totalInterest)}</strong></div>
          <div className={styles.figure}><span>{t('microfinance:fintech.calc.totalRepayment')}</span><strong>{formatCurrency(totalRepayment)}</strong></div>
          <div className={styles.figure}><span>{t('microfinance:fintech.calc.systemRate')}</span><strong>{systemRate.toFixed(2)}%</strong></div>
        </div>

        <div className={styles.split} aria-label={t('microfinance:fintech.calc.split')}>
          <div className={styles.splitBar}>
            <span className={styles.splitPrincipal} style={{ width: `${100 - interestShare}%` }} />
            <span className={styles.splitInterest} style={{ width: `${interestShare}%` }} />
          </div>
          <div className={styles.splitLegend}>
            <span><i className={styles.dotPrincipal} />{t('microfinance:loans.detail.scheduleColumns.principal')} {(100 - interestShare).toFixed(1)}%</span>
            <span><i className={styles.dotInterest} />{t('microfinance:loans.detail.scheduleColumns.interest')} {interestShare.toFixed(1)}%</span>
          </div>
        </div>

        <div className={styles.scheduleHead}>
          <h3>{t('microfinance:fintech.calc.scheduleTitle')}</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={printSchedule} disabled={schedule.length === 0}>
            <FiPrinter aria-hidden="true" /> {t('common:actions.print')}
          </button>
        </div>
        <div className={`table-wrapper ${styles.scheduleTable}`}>
          <table className={`table ${styles.dense}`}>
            <thead>
              <tr>
                <th className="cell-num">#</th>
                <th>{t('microfinance:loans.detail.scheduleColumns.dueDate')}</th>
                <th className="cell-num">{t('microfinance:loans.detail.scheduleColumns.principal')}</th>
                <th className="cell-num">{t('microfinance:loans.detail.scheduleColumns.interest')}</th>
                <th className="cell-num">{t('microfinance:fintech.calc.installment')}</th>
                <th className="cell-num">{t('microfinance:loans.detail.scheduleColumns.balance')}</th>
                <th>{t('microfinance:loans.detail.scheduleColumns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.n}>
                  <td className="cell-num">{row.n}</td>
                  <td className={styles.mono}>{formatDate(row.dueDate)}</td>
                  <td className="cell-num">{formatCurrency(row.principal)}</td>
                  <td className="cell-num">{formatCurrency(row.interest)}</td>
                  <td className="cell-num">{formatCurrency(row.total)}</td>
                  <td className="cell-num">{formatCurrency(row.balance)}</td>
                  <td><span className={`${styles.risk} ${styles.riskDue}`}>{t('microfinance:fintech.calc.scheduled')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>{t('microfinance:fintech.calc.note')}</p>
      </div>
    </div>
  );
}

export default LoanSimulator;
