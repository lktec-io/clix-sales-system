// Frontend loan maths shared by the simulator, risk badges and collections
// desk. Schedule generation mirrors backend/services/loan.service.js
// #generateScheduleInstallments so estimates match what disbursement creates.

import { toDayKey } from './reportData';

export const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };
export const DURATION_UNIT_DAYS = { days: 1, weeks: 7, months: 30 };
const PERIODS_PER_YEAR = { daily: 365, weekly: 52, monthly: 12 };

// Days an unpaid installment may run past its due date before the loan is
// treated as overdue. The backend has no grace field; this is a display rule.
export const GRACE_DAYS = 7;

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const addDays = (dayKey, days) => {
  const date = new Date(`${dayKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
};

// Backend semantics: 'flat' rate = % of principal for the whole term,
// 'reducing' rate = % per annum. Converts a monthly or annual quote into
// the number the loan product stores.
export function toSystemRate({ rate, basis, method, durationValue, durationUnit }) {
  const termMonths = (durationValue * DURATION_UNIT_DAYS[durationUnit]) / 30;
  if (method === 'reducing') return basis === 'monthly' ? rate * 12 : rate;
  return basis === 'monthly' ? rate * termMonths : rate * (termMonths / 12);
}

export function buildSchedule({ principal, rate, method, durationValue, durationUnit, frequency, startDate }) {
  if (!(principal > 0) || !(durationValue > 0)) return [];
  const periodDays = PERIOD_DAYS[frequency];
  const count = Math.max(1, Math.round((durationValue * DURATION_UNIT_DAYS[durationUnit]) / periodDays));
  if (count > 1000) return [];
  const dueDate = (i) => (startDate ? addDays(startDate, periodDays * i) : null);
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
      rows.push({ n: i, dueDate: dueDate(i), principal: principalDue, interest, total: round2(principalDue + interest), balance: Math.max(0, remaining) });
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
      rows.push({ n: i, dueDate: dueDate(i), principal: principalDue, interest, total: round2(principalDue + interest), balance: round2(principal - allocatedP) });
    }
  }
  return rows;
}

export const daysBetween = (fromKey, toKey) => Math.round(
  (new Date(`${toKey}T00:00:00`) - new Date(`${fromKey}T00:00:00`)) / 86400000,
);

export const installmentRemaining = (row) => Math.max(0, Number(row.total_due) - Number(row.amount_paid));

// Status of one schedule row today: paid | due (not yet late) | grace | overdue.
export function installmentHealth(row, today = toDayKey(new Date())) {
  if (row.status === 'paid' || installmentRemaining(row) <= 0) return 'paid';
  const late = daysBetween(toDayKey(row.due_date), today);
  if (late <= 0) return 'due';
  return late <= GRACE_DAYS ? 'grace' : 'overdue';
}

// Loan-level risk from its oldest unpaid installment:
// performing | grace | overdue (null when there is no schedule yet).
export function loanHealth(loan, today = toDayKey(new Date())) {
  if (loan.status === 'defaulted' || loan.status === 'written_off') return 'overdue';
  const schedule = loan.schedule || [];
  if (schedule.length === 0) return null;
  const states = schedule.map((row) => installmentHealth(row, today));
  if (states.includes('overdue')) return 'overdue';
  if (states.includes('grace')) return 'grace';
  return 'performing';
}

// Fraction of the scheduled total already paid.
export function paidFraction(schedule) {
  const total = schedule.reduce((a, r) => a + Number(r.total_due), 0);
  const paid = schedule.reduce((a, r) => a + Number(r.amount_paid), 0);
  return total ? Math.min(1, paid / total) : 0;
}
