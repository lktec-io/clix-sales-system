import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as savingsAccountRepository from '../repositories/savingsAccount.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Mirrors sale.service.js/purchase.service.js's identical helper.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

export async function listAccounts(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await savingsAccountRepository.findAll({
    tenantId, page, limit, search: query.search, customerId: query.customerId ? Number(query.customerId) : undefined,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getAccount(id, tenantId) {
  const account = await savingsAccountRepository.findById(id, tenantId);
  if (!account) throw new ApiError(404, 'Savings account not found');
  return account;
}

export async function getAccountTransactions(id, tenantId, query) {
  await getAccount(id, tenantId);
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  return savingsAccountRepository.findTransactions(id, tenantId, { page, limit });
}

export async function openAccount(data, actorId, tenantId) {
  const customer = await customerRepository.findById(data.customerId, tenantId);
  if (!customer) throw new ApiError(400, 'Selected customer does not exist');

  const accountNumber = await generateCode('SAVINGS', 'SAV', { tenantId, padLength: 6, includeYear: false });
  const account = await savingsAccountRepository.create({ tenantId, customerId: data.customerId, accountNumber, openedBy: actorId });

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: null,
    description: `Savings account "${accountNumber}" opened for ${customer.first_name} ${customer.last_name}`,
    referenceType: 'savings_account', referenceId: account.id,
  });

  return account;
}

// Locks the account row for the duration of the transaction so two
// concurrent withdrawals can never both compute a "balance before" that's
// gone stale by the time either writes — the second waits for the first's
// transaction to commit, then reads the already-updated balance.
export async function recordTransaction(data, actorId, tenantId, user) {
  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, data.branchId);

  const amount = Number(data.amount);
  if (amount <= 0) throw new ApiError(400, 'Amount must be greater than zero');

  const connection = await pool.getConnection();
  let balanceAfter;
  try {
    await connection.beginTransaction();
    const account = await savingsAccountRepository.findByIdForUpdate(data.savingsAccountId, tenantId, connection);
    if (!account) throw new ApiError(404, 'Savings account not found');
    if (account.status !== 'active') throw new ApiError(400, 'This savings account is closed');

    if (data.type === 'withdrawal' && amount > Number(account.balance)) {
      throw new ApiError(400, `Insufficient balance — available balance is ${formatCurrency(account.balance)}`);
    }

    balanceAfter = data.type === 'deposit'
      ? round2(Number(account.balance) + amount)
      : round2(Number(account.balance) - amount);

    await savingsAccountRepository.updateBalance(data.savingsAccountId, balanceAfter, connection);
    await savingsAccountRepository.createTransaction({
      tenantId, savingsAccountId: data.savingsAccountId, branchId: data.branchId, type: data.type,
      amount, balanceAfter, reference: data.reference, recordedBy: actorId,
    }, connection);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: data.branchId,
    description: `${data.type === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${formatCurrency(amount)} recorded on savings account`,
    referenceType: 'savings_transaction', referenceId: data.savingsAccountId,
  });

  return savingsAccountRepository.findById(data.savingsAccountId, tenantId);
}
