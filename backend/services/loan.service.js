import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as loanRepository from '../repositories/loan.repository.js';
import * as loanProductRepository from '../repositories/loanProduct.repository.js';
import * as loanScheduleRepository from '../repositories/loanSchedule.repository.js';
import * as loanRepaymentRepository from '../repositories/loanRepayment.repository.js';
import * as loanGuarantorRepository from '../repositories/loanGuarantor.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as savingsAccountRepository from '../repositories/savingsAccount.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };
const DURATION_UNIT_DAYS = { days: 1, weeks: 7, months: 30 };
const PERIODS_PER_YEAR = { daily: 365, weekly: 52, monthly: 12 };

// Mirrors sale.service.js/purchase.service.js's identical helper.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Real amortization math, not a stub. 'flat' spreads principal and simple
// interest (principal * rate%) evenly across every installment. 'reducing'
// computes a standard declining-balance annuity: a fixed periodic
// installment payment where the interest portion shrinks (and the
// principal portion grows) each period as the outstanding balance falls.
// Processing fee is deducted at disbursement, not added to the repayment
// schedule — the borrower repays principal + interest only.
export function generateScheduleInstallments({ principal, interestRate, interestMethod, durationValue, durationUnit, repaymentFrequency, disbursementDate }) {
  const periodDays = PERIOD_DAYS[repaymentFrequency];
  const totalDays = durationValue * DURATION_UNIT_DAYS[durationUnit];
  const installmentCount = Math.max(1, Math.round(totalDays / periodDays));
  const installments = [];

  if (interestMethod === 'reducing') {
    const periodicRate = (interestRate / 100) / PERIODS_PER_YEAR[repaymentFrequency];
    const installmentPayment = periodicRate === 0
      ? principal / installmentCount
      : (principal * periodicRate) / (1 - (1 + periodicRate) ** -installmentCount);

    let remainingPrincipal = principal;
    for (let i = 1; i <= installmentCount; i += 1) {
      const interestDue = round2(remainingPrincipal * periodicRate);
      let principalDue = round2(installmentPayment - interestDue);
      if (i === installmentCount) principalDue = round2(remainingPrincipal);
      remainingPrincipal = round2(remainingPrincipal - principalDue);
      installments.push({
        installmentNumber: i,
        dueDate: addDays(disbursementDate, periodDays * i),
        principalDue, interestDue, feesDue: 0,
        totalDue: round2(principalDue + interestDue),
      });
    }
  } else {
    const totalInterest = round2(principal * (interestRate / 100));
    const basePrincipal = round2(principal / installmentCount);
    const baseInterest = round2(totalInterest / installmentCount);
    let allocatedPrincipal = 0;
    let allocatedInterest = 0;

    for (let i = 1; i <= installmentCount; i += 1) {
      const isLast = i === installmentCount;
      const principalDue = isLast ? round2(principal - allocatedPrincipal) : basePrincipal;
      const interestDue = isLast ? round2(totalInterest - allocatedInterest) : baseInterest;
      allocatedPrincipal = round2(allocatedPrincipal + principalDue);
      allocatedInterest = round2(allocatedInterest + interestDue);
      installments.push({
        installmentNumber: i,
        dueDate: addDays(disbursementDate, periodDays * i),
        principalDue, interestDue, feesDue: 0,
        totalDue: round2(principalDue + interestDue),
      });
    }
  }

  return installments;
}

export async function listLoans(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);
  const { rows, total } = await loanRepository.findAll({
    tenantId: user.tenantId, page, limit, search: query.search, status: query.status,
    customerId: query.customerId ? Number(query.customerId) : undefined,
    branchId: query.branchId ? Number(query.branchId) : undefined,
    branchIds,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getLoan(id, tenantId) {
  const loan = await loanRepository.findById(id, tenantId);
  if (!loan) throw new ApiError(404, 'Loan not found');
  await loanScheduleRepository.markOverdueForTenant(tenantId);
  const [schedule, guarantors, repayments] = await Promise.all([
    loanScheduleRepository.findByLoan(id),
    loanGuarantorRepository.findByLoan(id),
    loanRepaymentRepository.findByLoan(id, tenantId),
  ]);
  return { ...loan, schedule, guarantors, repayments };
}

const DURATION_UNIT_TO_FREQUENCY = { days: 'daily', weeks: 'weekly', months: 'monthly' };

export async function applyForLoan(data, actorId, tenantId, user) {
  const customer = await customerRepository.findById(data.customerId, tenantId);
  if (!customer) throw new ApiError(400, 'Selected borrower does not exist');

  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, data.branchId);

  const requestedAmount = Number(data.requestedAmount);
  if (requestedAmount <= 0) throw new ApiError(400, 'Loan amount must be greater than zero');

  // The simplified Microfinance workflow enters terms directly on the loan
  // (loanProductId absent) rather than requiring a pre-configured Loan
  // Product — loans.loan_product_id is nullable specifically for this path
  // (030_simplify_microfinance_loans.sql). Supplying a loanProductId still
  // works exactly as before, for any caller that has one.
  let loanTerms;
  if (data.loanProductId) {
    const product = await loanProductRepository.findById(data.loanProductId, tenantId);
    if (!product || product.status !== 'active') throw new ApiError(400, 'Selected loan product is not available');
    if (requestedAmount < Number(product.min_amount) || requestedAmount > Number(product.max_amount)) {
      throw new ApiError(400, `Requested amount must be between ${formatCurrency(product.min_amount)} and ${formatCurrency(product.max_amount)} for this loan product`);
    }
    loanTerms = {
      interestRate: product.interest_rate, interestMethod: product.interest_method,
      durationValue: product.duration_value, durationUnit: product.duration_unit,
      repaymentFrequency: product.repayment_frequency,
      processingFeeAmount: round2(requestedAmount * (Number(product.processing_fee_percent) / 100)),
    };
  } else {
    const interestRate = Number(data.interestRate);
    const durationValue = Number(data.durationValue);
    const durationUnit = data.durationUnit;
    if (!(interestRate >= 0)) throw new ApiError(400, 'Interest rate must be zero or greater');
    if (!(durationValue > 0)) throw new ApiError(400, 'Duration must be greater than zero');
    if (!DURATION_UNIT_TO_FREQUENCY[durationUnit]) throw new ApiError(400, 'Invalid duration unit');
    loanTerms = {
      interestRate, interestMethod: 'flat', durationValue, durationUnit,
      repaymentFrequency: DURATION_UNIT_TO_FREQUENCY[durationUnit],
      processingFeeAmount: 0,
    };
  }

  const loanNumber = await generateCode('LOAN', 'LN', { tenantId, padLength: 6 });

  const connection = await pool.getConnection();
  let loanId;
  try {
    await connection.beginTransaction();
    loanId = await loanRepository.create({
      tenantId, branchId: data.branchId, loanNumber, customerId: data.customerId,
      loanProductId: data.loanProductId || null,
      requestedAmount, ...loanTerms, purpose: data.purpose, requestedStartDate: data.startDate, appliedBy: actorId,
    }, connection);

    for (const guarantor of data.guarantors || []) {
      await loanGuarantorRepository.create({
        loanId, customerId: guarantor.customerId || null, guarantorName: guarantor.guarantorName,
        guarantorPhone: guarantor.guarantorPhone, guaranteedAmount: guarantor.guaranteedAmount,
      }, connection);
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: data.branchId,
    description: `Loan application "${loanNumber}" submitted for ${customer.first_name} ${customer.last_name}`,
    referenceType: 'loan', referenceId: loanId,
  });

  return loanRepository.findById(loanId, tenantId);
}

export async function markUnderReview(id, tenantId) {
  const loan = await getLoan(id, tenantId);
  if (loan.status !== 'submitted') throw new ApiError(400, 'Only a submitted application can be moved to review');
  await loanRepository.setUnderReview(id, tenantId);
  return loanRepository.findById(id, tenantId);
}

export async function approveLoan(id, data, actorId, tenantId) {
  const loan = await loanRepository.findById(id, tenantId);
  if (!loan) throw new ApiError(404, 'Loan not found');
  if (!['submitted', 'under_review'].includes(loan.status)) {
    throw new ApiError(400, 'Only a submitted or under-review application can be approved');
  }

  const approvedAmount = Number(data.approvedAmount ?? loan.requested_amount);
  if (approvedAmount <= 0) throw new ApiError(400, 'Approved amount must be greater than zero');

  // Only a product-based loan has min/max bounds to enforce — a
  // directly-entered loan (loan_product_id null) has none, by design.
  if (loan.loan_product_id) {
    const product = await loanProductRepository.findById(loan.loan_product_id, tenantId);
    if (product && (approvedAmount < Number(product.min_amount) || approvedAmount > Number(product.max_amount))) {
      throw new ApiError(400, `Approved amount must be between ${formatCurrency(product.min_amount)} and ${formatCurrency(product.max_amount)}`);
    }
  }

  await loanRepository.approve(id, tenantId, { approvedAmount, approvedBy: actorId });

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: loan.branch_id,
    description: `Loan "${loan.loan_number}" approved (${formatCurrency(approvedAmount)})`,
    referenceType: 'loan', referenceId: id,
  });

  return loanRepository.findById(id, tenantId);
}

export async function rejectLoan(id, data, actorId, tenantId) {
  const loan = await loanRepository.findById(id, tenantId);
  if (!loan) throw new ApiError(404, 'Loan not found');
  if (!['submitted', 'under_review'].includes(loan.status)) {
    throw new ApiError(400, 'Only a submitted or under-review application can be rejected');
  }

  await loanRepository.reject(id, tenantId, { rejectionReason: data.rejectionReason, approvedBy: actorId });

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: loan.branch_id,
    description: `Loan "${loan.loan_number}" rejected`,
    referenceType: 'loan', referenceId: id,
  });

  return loanRepository.findById(id, tenantId);
}

// The whole disbursement — schedule generation and the loan status/balance
// flip — is one all-or-nothing transaction, the same guarantee
// purchase.service.js's createPurchase() gives its stock movements.
export async function disburseLoan(id, actorId, tenantId) {
  const loan = await loanRepository.findById(id, tenantId);
  if (!loan) throw new ApiError(404, 'Loan not found');
  if (loan.status !== 'approved') throw new ApiError(400, 'Only an approved loan can be disbursed');

  const disbursementDate = new Date();
  const installments = generateScheduleInstallments({
    principal: Number(loan.approved_amount),
    interestRate: Number(loan.interest_rate),
    interestMethod: loan.interest_method,
    durationValue: loan.duration_value,
    durationUnit: loan.duration_unit,
    repaymentFrequency: loan.repayment_frequency,
    disbursementDate,
  });

  const principalOutstanding = round2(installments.reduce((sum, i) => sum + i.principalDue, 0));
  const interestOutstanding = round2(installments.reduce((sum, i) => sum + i.interestDue, 0));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await loanScheduleRepository.bulkCreate(id, installments, connection);
    await loanRepository.markDisbursed(id, tenantId, { disbursedBy: actorId, principalOutstanding, interestOutstanding }, connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: loan.branch_id,
    description: `Loan "${loan.loan_number}" disbursed (${formatCurrency(loan.approved_amount)})`,
    referenceType: 'loan', referenceId: id,
  });
  await notificationRepository.notifyBranchManagement(tenantId, loan.branch_id, {
    type: 'success', category: 'loan_disbursed', title: 'Loan disbursed',
    message: `Loan "${loan.loan_number}" (${formatCurrency(loan.approved_amount)}) has been disbursed`,
    referenceType: 'loan', referenceId: id,
  });

  return loanRepository.findById(id, tenantId);
}

// Allocates one repayment across the loan's oldest-due-first outstanding
// installments — a real ledger entry plus per-installment allocation rows,
// never a single balance field silently overwritten. Rejects an amount
// that would overpay the loan rather than let the balance go negative.
export async function recordRepayment(data, actorId, tenantId) {
  const loan = await loanRepository.findById(data.loanId, tenantId);
  if (!loan) throw new ApiError(404, 'Loan not found');
  if (!['active'].includes(loan.status)) throw new ApiError(400, 'Only an active loan can receive a repayment');

  const amount = Number(data.amount);
  if (amount <= 0) throw new ApiError(400, 'Repayment amount must be greater than zero');

  const totalOutstanding = round2(Number(loan.principal_outstanding) + Number(loan.interest_outstanding));
  if (amount > totalOutstanding) {
    throw new ApiError(400, `Repayment amount exceeds the outstanding balance of ${formatCurrency(totalOutstanding)}`);
  }

  const receiptNumber = await generateCode('LOAN_RECEIPT', 'RCP', { tenantId, padLength: 6 });

  const connection = await pool.getConnection();
  let repaymentId;
  try {
    await connection.beginTransaction();

    const unpaidSchedules = await loanScheduleRepository.findUnpaidByLoan(data.loanId, connection);
    repaymentId = await loanRepaymentRepository.create({
      tenantId, loanId: data.loanId, branchId: loan.branch_id, receiptNumber, amount,
      paymentDate: data.paymentDate || new Date(), paymentMethod: data.paymentMethod,
      reference: data.reference, recordedBy: actorId,
    }, connection);

    let remaining = amount;
    for (const schedule of unpaidSchedules) {
      if (remaining <= 0) break;
      const due = round2(Number(schedule.total_due) - Number(schedule.amount_paid));
      const applied = round2(Math.min(due, remaining));
      if (applied <= 0) continue;

      const newAmountPaid = round2(Number(schedule.amount_paid) + applied);
      const status = newAmountPaid >= Number(schedule.total_due) ? 'paid' : 'partial';
      await loanScheduleRepository.applyPayment(schedule.id, { amountPaid: newAmountPaid, status }, connection);
      await loanRepaymentRepository.createAllocation(repaymentId, schedule.id, applied, connection);
      remaining = round2(remaining - applied);
    }

    // Recompute outstanding balances from the schedule itself (the source
    // of truth) rather than subtracting the payment from the old totals —
    // this stays correct even if a future change allows partial waivers or
    // schedule edits, since it never compounds a stale running total.
    const freshSchedule = await loanScheduleRepository.findByLoan(data.loanId);
    const principalOutstanding = round2(freshSchedule.reduce((sum, s) => {
      const paidRatio = Number(s.total_due) > 0 ? Number(s.amount_paid) / Number(s.total_due) : 0;
      return sum + Math.max(0, Number(s.principal_due) * (1 - paidRatio));
    }, 0));
    const interestOutstanding = round2(freshSchedule.reduce((sum, s) => {
      const paidRatio = Number(s.total_due) > 0 ? Number(s.amount_paid) / Number(s.total_due) : 0;
      return sum + Math.max(0, Number(s.interest_due) * (1 - paidRatio));
    }, 0));
    const completed = freshSchedule.every((s) => s.status === 'paid');

    await loanRepository.updateOutstanding(data.loanId, tenantId, { principalOutstanding, interestOutstanding, completed }, connection);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: loan.branch_id,
    description: `Repayment of ${formatCurrency(amount)} recorded for loan "${loan.loan_number}"`,
    referenceType: 'loan_repayment', referenceId: repaymentId,
  });
  await notificationRepository.notifyBranchManagement(tenantId, loan.branch_id, {
    type: 'success', category: 'loan_repayment_recorded', title: 'Repayment recorded',
    message: `Repayment of ${formatCurrency(amount)} recorded for loan "${loan.loan_number}"`,
    referenceType: 'loan_repayment', referenceId: repaymentId,
  });

  return loanRepaymentRepository.findById(repaymentId, tenantId);
}

export async function addGuarantor(loanId, data, tenantId) {
  const loan = await loanRepository.findById(loanId, tenantId);
  if (!loan) throw new ApiError(404, 'Loan not found');
  await loanGuarantorRepository.create({
    loanId, customerId: data.customerId || null, guarantorName: data.guarantorName,
    guarantorPhone: data.guarantorPhone, guaranteedAmount: data.guaranteedAmount,
  });
  return loanGuarantorRepository.findByLoan(loanId);
}

export async function writeOffLoan(id, actorId, tenantId) {
  const loan = await loanRepository.findById(id, tenantId);
  if (!loan) throw new ApiError(404, 'Loan not found');
  if (!['active', 'defaulted'].includes(loan.status)) throw new ApiError(400, 'Only an active or defaulted loan can be written off');

  await loanRepository.writeOff(id, tenantId, actorId);
  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: loan.branch_id,
    description: `Loan "${loan.loan_number}" written off`,
    referenceType: 'loan', referenceId: id,
  });
  return loanRepository.findById(id, tenantId);
}

export async function getPortfolioKpis(user) {
  const branchIds = await getAccessibleBranchIds(user);
  const [portfolio, overdue, collections, savingsBalance] = await Promise.all([
    loanRepository.getPortfolioSummary(user.tenantId, branchIds),
    loanRepository.getOverdueSummary(user.tenantId, branchIds),
    loanRepaymentRepository.getCollectionsSummary(user.tenantId, branchIds),
    savingsAccountRepository.getTotalBalance(user.tenantId),
  ]);
  return { ...portfolio, ...overdue, ...collections, totalSavingsBalance: savingsBalance };
}

export async function getRecentApplications(user, limit = 5) {
  const branchIds = await getAccessibleBranchIds(user);
  return loanRepository.findRecent(user.tenantId, branchIds, limit);
}
