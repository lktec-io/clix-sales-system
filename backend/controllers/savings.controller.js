import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as savingsService from '../services/savings.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await savingsService.listAccounts(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const account = await savingsService.getAccount(Number(req.params.id), req.user.tenantId);
  return success(res, { data: account });
});

export const getTransactions = asyncHandler(async (req, res) => {
  const result = await savingsService.getAccountTransactions(Number(req.params.id), req.user.tenantId, req.query);
  return success(res, { data: { items: result.rows, meta: { total: result.total } } });
});

export const openAccount = asyncHandler(async (req, res) => {
  const account = await savingsService.openAccount(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Savings account opened', data: account, status: 201 });
});

export const recordTransaction = asyncHandler(async (req, res) => {
  const account = await savingsService.recordTransaction(
    { ...req.body, savingsAccountId: Number(req.params.id) },
    req.user.id,
    req.user.tenantId,
    req.user,
  );
  return success(res, { message: 'Transaction recorded', data: account, status: 201 });
});
