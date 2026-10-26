import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCheckCircle, FiMessageSquare, FiFileText, FiRefreshCw, FiCopy, FiPrinter, FiSend } from 'react-icons/fi';
import Modal from '../common/Modal';
import CashflowChart from './CashflowChart';
import RiskBadge from './RiskBadge';
import { useAuth } from '../../hooks/useAuth';
import { useCompany } from '../../hooks/useCompany';
import { useToast } from '../../hooks/useToast';
import { useReportLoader } from '../../hooks/useReportLoader';
import { useCollectionsBook, useRepaymentsSince } from '../../hooks/useCollectionsBook';
import * as loanService from '../../services/loanService';
import * as userService from '../../services/userService';
import { inRange, presetRange, toDayKey, sum } from '../../utils/reportData';
import { installmentHealth, installmentRemaining } from '../../utils/loanMath';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import { escapeHtml, printDocument } from '../../utils/printDocument';
import styles from './Microfinance.module.css';

const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'cheque', 'other'];

function weekRange(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return { from: toDayKey(start), to: toDayKey(now) };
}

const RANGES = {
  today: () => presetRange('today'),
  yesterday: () => presetRange('yesterday'),
  week: () => weekRange(),
};

const borrowerName = (loan) => `${loan.borrower_first_name || ''} ${loan.borrower_last_name || ''}`.trim();
const outstandingOf = (loan) => (Number(loan.principal_outstanding) || 0) + (Number(loan.interest_outstanding) || 0);

// Field officers' collections desk: 30-day cashflow, daily due log with
// quick actions, and per-officer reconciliation of money received.
function CollectionsDesk() {
  const { t, i18n } = useTranslation(['microfinance', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { company } = useCompany();
  const canRecord = hasPermission('loan_repayments.create');
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';

  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState(() => weekRange());
  const [withArrears, setWithArrears] = useState(true);
  const range = preset === 'custom' ? custom : RANGES[preset]();
  const chartWindow = presetRange('30d');
  const since = [chartWindow.from, range.from].sort()[0];

  const book = useCollectionsBook(since);
  const payments = useRepaymentsSince(since);
  const users = useReportLoader(
    () => (hasPermission('users.view') ? userService.listUsers({ page: 1, limit: 200 }).then((r) => r.items || []) : Promise.resolve([])),
    [],
  );

  const [recordFor, setRecordFor] = useState(null);
  const [smsFor, setSmsFor] = useState(null);
  const [receiptFor, setReceiptFor] = useState(null);

  const loans = useMemo(() => book.data?.loans || [], [book.data]);
  const paymentRows = useMemo(() => payments.data?.rows || [], [payments.data]);
  const today = toDayKey(new Date());

  const log = useMemo(() => {
    const rows = [];
    loans.forEach((loan) => (loan.schedule || []).forEach((row) => {
      const due = toDayKey(row.due_date);
      const health = installmentHealth(row, today);
      const inWindow = due >= range.from && due <= range.to;
      const arrear = withArrears && due < range.from && (health === 'grace' || health === 'overdue');
      if (inWindow || arrear) rows.push({ key: `${loan.id}-${row.id}`, loan, row, due, health, remaining: installmentRemaining(row) });
    }));
    const order = { overdue: 0, grace: 1, due: 2, paid: 3 };
    return rows.sort((a, b) => order[a.health] - order[b.health] || a.due.localeCompare(b.due));
  }, [loans, range.from, range.to, withArrears, today]);

  const officers = useMemo(() => {
    const names = Object.fromEntries((users.data || []).map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim()]));
    const groups = new Map();
    paymentRows.filter((p) => inRange(p.payment_date || p.created_at, range.from, range.to)).forEach((p) => {
      const id = p.recorded_by;
      const g = groups.get(id) || { id, name: names[id] || t('microfinance:fintech.officers.staff', { id }), count: 0, total: 0, cash: 0, mobile: 0, other: 0 };
      const amount = Number(p.amount) || 0;
      g.count += 1;
      g.total += amount;
      if (p.payment_method === 'cash') g.cash += amount;
      else if (p.payment_method === 'mobile_money') g.mobile += amount;
      else g.other += amount;
      groups.set(id, g);
    });
    return [...groups.values()].sort((a, b) => b.total - a.total);
  }, [paymentRows, users.data, range.from, range.to, t]);

  const dueTotal = sum(log, (r) => r.row.total_due);
  const paidTotal = sum(log, (r) => r.row.amount_paid);
  const formatDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  const reload = () => { book.reload(); payments.reload(); };
  const loading = book.loading || payments.loading;

  return (
    <div className={styles.desk}>
      <section className={`card ${styles.panel}`}>
        <div className={styles.panelHead}>
          <div>
            <h2>{t('microfinance:fintech.cashflow.title')}</h2>
            <p>{t('microfinance:fintech.cashflow.subtitle')}</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload} disabled={loading}>
            <FiRefreshCw aria-hidden="true" /> {t('common:actions.retry')}
          </button>
        </div>
        {book.loading && !book.data ? (
          <div className={`${styles.chartSkeleton} skeleton`} />
        ) : (
          <CashflowChart loans={loans} payments={paymentRows} from={chartWindow.from} to={chartWindow.to} />
        )}
        {book.data?.truncated && <p className={styles.note}>{t('microfinance:fintech.truncated')}</p>}
        {book.error && <p className={styles.errorNote}>{t('microfinance:fintech.loadError')}</p>}
      </section>

      <section className={`card ${styles.panel}`}>
        <div className={styles.panelHead}>
          <div>
            <h2>{t('microfinance:fintech.log.title')}</h2>
            <p>{t('microfinance:fintech.log.subtitle')}</p>
          </div>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.pills} role="group" aria-label={t('microfinance:fintech.log.range')}>
            {['today', 'yesterday', 'week', 'custom'].map((key) => (
              <button key={key} type="button" className={styles.pill} aria-pressed={preset === key} onClick={() => setPreset(key)}>
                {t(`microfinance:fintech.log.ranges.${key}`)}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className={styles.dates}>
              <label>{t('common:labels.dateFrom')}<input type="date" className="form-control" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value || c.from }))} /></label>
              <label>{t('common:labels.dateTo')}<input type="date" className="form-control" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value || c.to }))} /></label>
            </div>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={withArrears} onChange={(e) => setWithArrears(e.target.checked)} />
            {t('microfinance:fintech.log.withArrears')}
          </label>
        </div>

        <div className={styles.logStats}>
          <div><span>{t('microfinance:fintech.log.installments')}</span><strong>{formatNumber(log.length)}</strong></div>
          <div><span>{t('microfinance:fintech.log.dueTotal')}</span><strong>{formatCurrency(dueTotal)}</strong></div>
          <div><span>{t('microfinance:fintech.log.collected')}</span><strong className={styles.positive}>{formatCurrency(paidTotal)}</strong></div>
          <div><span>{t('microfinance:fintech.log.outstanding')}</span><strong className={dueTotal - paidTotal > 0 ? styles.negative : undefined}>{formatCurrency(Math.max(0, dueTotal - paidTotal))}</strong></div>
        </div>

        <div className="table-wrapper">
          <table className={`table ${styles.dense}`}>
            <thead>
              <tr>
                <th>{t('microfinance:loans.columns.borrower')}</th>
                <th>{t('microfinance:loans.columns.loanNumber')}</th>
                <th>{t('microfinance:loans.detail.scheduleColumns.dueDate')}</th>
                <th className="cell-num">{t('microfinance:fintech.log.due')}</th>
                <th className="cell-num">{t('microfinance:loans.detail.scheduleColumns.paid')}</th>
                <th>{t('microfinance:loans.detail.scheduleColumns.status')}</th>
                <th>{t('microfinance:fintech.log.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && log.length === 0 && (
                <tr><td colSpan={7} className={styles.emptyCell}>{t('common:state.loading')}</td></tr>
              )}
              {!loading && log.length === 0 && (
                <tr><td colSpan={7} className={styles.emptyCell}>{t('microfinance:fintech.log.empty')}</td></tr>
              )}
              {log.map(({ key, loan, row, due, health, remaining }) => (
                <tr key={key} className={health === 'overdue' ? 'row-danger' : undefined}>
                  <td>
                    <div className={styles.who}>{borrowerName(loan)}</div>
                    {loan.borrower_phone && <div className={styles.sub}>{loan.borrower_phone}</div>}
                  </td>
                  <td>
                    <button type="button" className={styles.linkCell} onClick={() => navigate(`/loans/${loan.id}`)}>{loan.loan_number}</button>
                    <div className={styles.sub}>#{row.installment_number}</div>
                  </td>
                  <td className={styles.mono}>{formatDate(due)}</td>
                  <td className="cell-num">{formatCurrency(row.total_due)}</td>
                  <td className="cell-num">{formatCurrency(row.amount_paid)}</td>
                  <td><RiskBadge health={health} /></td>
                  <td>
                    <div className={styles.actions}>
                      {canRecord && loan.status === 'active' && remaining > 0 && (
                        <button type="button" className="btn btn-success btn-sm" onClick={() => setRecordFor({ loan, remaining })}>
                          <FiCheckCircle aria-hidden="true" /> {t('microfinance:fintech.actions.record')}
                        </button>
                      )}
                      {remaining > 0 && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSmsFor({ loan, row, remaining })}>
                          <FiMessageSquare aria-hidden="true" /> {t('microfinance:fintech.actions.sms')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={(loan.repayments || []).length === 0}
                        title={(loan.repayments || []).length === 0 ? t('microfinance:fintech.receipt.none') : undefined}
                        onClick={() => setReceiptFor({ loan, repayment: loan.repayments[0] })}
                      >
                        <FiFileText aria-hidden="true" /> {t('microfinance:fintech.actions.receipt')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`card ${styles.panel}`}>
        <div className={styles.panelHead}>
          <div>
            <h2>{t('microfinance:fintech.officers.title')}</h2>
            <p>{t('microfinance:fintech.officers.subtitle')}</p>
          </div>
        </div>
        {officers.length === 0 ? (
          <p className={styles.emptyCell}>{payments.loading ? t('common:state.loading') : t('microfinance:fintech.officers.empty')}</p>
        ) : (
          <div className={styles.officerGrid}>
            {officers.map((o) => (
              <article key={o.id} className={styles.officer}>
                <header>
                  <strong>{o.name}</strong>
                  <span className={styles.sub}>{t('microfinance:fintech.officers.payments', { count: o.count })}</span>
                </header>
                <div className={styles.officerTotal}>{formatCurrency(o.total)}</div>
                <dl>
                  <dt>{t('microfinance:loans.paymentMethods.cash')}</dt><dd>{formatCurrency(o.cash)}</dd>
                  <dt>{t('microfinance:loans.paymentMethods.mobile_money')}</dt><dd>{formatCurrency(o.mobile)}</dd>
                  <dt>{t('microfinance:fintech.officers.other')}</dt><dd>{formatCurrency(o.other)}</dd>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      {recordFor && (
        <RecordPaymentModal
          target={recordFor}
          onClose={() => setRecordFor(null)}
          onRecorded={() => { setRecordFor(null); toast.success(t('microfinance:loans.detail.recordSuccess')); reload(); }}
        />
      )}
      {smsFor && <SmsPreviewModal target={smsFor} companyName={company?.company_name} formatDate={formatDate} onClose={() => setSmsFor(null)} />}
      {receiptFor && <ReceiptModal target={receiptFor} companyName={company?.company_name} formatDate={formatDate} onClose={() => setReceiptFor(null)} />}
    </div>
  );
}

function RecordPaymentModal({ target, onClose, onRecorded }) {
  const { t } = useTranslation(['microfinance', 'common']);
  const { loan, remaining } = target;
  const balance = outstandingOf(loan);
  const [values, setValues] = useState({ amount: String(Math.min(remaining, balance)), paymentMethod: 'cash', paymentDate: toDayKey(new Date()), reference: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(values.amount);
    if (!(amount > 0)) { setError(t('microfinance:fintech.record.amountRequired')); return; }
    if (amount > balance) { setError(t('microfinance:loans.detail.repaymentExceedsBalance', { balance: formatCurrency(balance) })); return; }
    setError('');
    setSaving(true);
    try {
      await loanService.recordRepayment({
        loanId: loan.id, amount, paymentMethod: values.paymentMethod,
        paymentDate: values.paymentDate, reference: values.reference || undefined,
      });
      onRecorded();
    } catch (err) {
      setError(err.response?.data?.message || t('microfinance:loans.detail.recordError'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('microfinance:fintech.actions.record')}
      size="sm"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common:actions.cancel')}</button>
          <button type="submit" form="desk-record-form" className={`btn btn-success ${saving ? 'btn-loading' : ''}`} disabled={saving}>
            {t('microfinance:fintech.actions.record')}
          </button>
        </>
      )}
    >
      {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
      <dl className={styles.facts}>
        <dt>{t('microfinance:loans.columns.borrower')}</dt><dd>{borrowerName(loan)} · {loan.loan_number}</dd>
        <dt>{t('microfinance:fintech.record.installmentDue')}</dt><dd className={styles.mono}>{formatCurrency(remaining)}</dd>
        <dt>{t('microfinance:loans.detail.outstandingBalance')}</dt><dd className={styles.mono}>{formatCurrency(balance)}</dd>
      </dl>
      <form id="desk-record-form" onSubmit={submit} noValidate>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="desk-amount">{t('microfinance:loans.detail.repaymentAmountLabel')}</label>
          <input id="desk-amount" type="number" min="0" max={balance} step="0.01" className="form-control" value={values.amount} onChange={set('amount')} />
        </div>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="desk-date">{t('microfinance:loans.detail.paymentDateLabel')}</label>
          <input id="desk-date" type="date" className="form-control" value={values.paymentDate} onChange={set('paymentDate')} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="desk-method">{t('microfinance:loans.detail.paymentMethodLabel')}</label>
          <select id="desk-method" className="form-control" value={values.paymentMethod} onChange={set('paymentMethod')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`microfinance:loans.paymentMethods.${m}`)}</option>)}
          </select>
        </div>
        <div className="form-group mb-0">
          <label className="form-label" htmlFor="desk-ref">{t('microfinance:loans.detail.notesLabel')}</label>
          <input id="desk-ref" className="form-control" value={values.reference} onChange={set('reference')} />
        </div>
        <p className={styles.note}>{t('microfinance:fintech.record.allocationNote')}</p>
      </form>
    </Modal>
  );
}

function SmsPreviewModal({ target, companyName, formatDate, onClose }) {
  const { t } = useTranslation(['microfinance', 'common']);
  const { loan, row, remaining } = target;
  const message = t('microfinance:fintech.sms.template', {
    name: loan.borrower_first_name || borrowerName(loan),
    amount: formatCurrency(remaining),
    loan: loan.loan_number,
    date: formatDate(toDayKey(row.due_date)),
    company: companyName || 'Clix Sales System',
  });
  const phone = loan.borrower_phone || '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // Clipboard can be blocked (insecure origin); the text stays selectable.
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('microfinance:fintech.sms.title')}
      size="sm"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={copy}><FiCopy aria-hidden="true" /> {t('microfinance:fintech.sms.copy')}</button>
          {phone && (
            <a className="btn btn-primary" href={`sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(message)}`}>
              <FiSend aria-hidden="true" /> {t('microfinance:fintech.sms.open')}
            </a>
          )}
        </>
      )}
    >
      <dl className={styles.facts}>
        <dt>{t('microfinance:fintech.sms.to')}</dt><dd className={styles.mono}>{phone || t('microfinance:fintech.sms.noPhone')}</dd>
      </dl>
      <div className={styles.smsBubble}>{message}</div>
      <p className={styles.note}>{t('microfinance:fintech.sms.note', { count: message.length })}</p>
    </Modal>
  );
}

function ReceiptModal({ target, companyName, formatDate, onClose }) {
  const { t } = useTranslation(['microfinance', 'common']);
  const { loan, repayment } = target;
  const company = companyName || 'Clix Sales System';
  const facts = [
    [t('microfinance:loans.detail.receiptNumber'), repayment.receipt_number],
    [t('microfinance:loans.detail.paymentDateLabel'), formatDate(toDayKey(repayment.payment_date))],
    [t('microfinance:loans.columns.borrower'), borrowerName(loan)],
    [t('microfinance:loans.columns.loanNumber'), loan.loan_number],
    [t('microfinance:loans.detail.paymentMethodLabel'), t(`microfinance:loans.paymentMethods.${repayment.payment_method}`)],
    [t('microfinance:loans.detail.referenceLabel'), repayment.reference || '—'],
    [t('microfinance:fintech.receipt.balanceAfter'), formatCurrency(outstandingOf(loan))],
  ];

  const print = () => printDocument(`${t('microfinance:fintech.receipt.title')} ${repayment.receipt_number}`, `
    <h1>${escapeHtml(company)}</h1>
    <p class="muted">${escapeHtml(t('microfinance:fintech.receipt.title'))}</p>
    <dl>${facts.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
    <div class="total">${escapeHtml(t('microfinance:loans.detail.repaymentAmountLabel'))}: <span class="mono">${escapeHtml(formatCurrency(repayment.amount))}</span></div>
  `);

  return (
    <Modal
      open
      onClose={onClose}
      title={t('microfinance:fintech.receipt.title')}
      size="sm"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common:actions.close')}</button>
          <button type="button" className="btn btn-primary" onClick={print}><FiPrinter aria-hidden="true" /> {t('common:actions.print')}</button>
        </>
      )}
    >
      <div className={styles.receipt}>
        <div className={styles.receiptHead}>
          <strong>{company}</strong>
          <span>{t('microfinance:fintech.receipt.latest')}</span>
        </div>
        <dl className={styles.facts}>
          {facts.map(([k, v]) => (
            <div key={k} className={styles.factRow}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <div className={styles.receiptTotal}>
          <span>{t('microfinance:loans.detail.repaymentAmountLabel')}</span>
          <strong>{formatCurrency(repayment.amount)}</strong>
        </div>
      </div>
    </Modal>
  );
}

export default CollectionsDesk;
