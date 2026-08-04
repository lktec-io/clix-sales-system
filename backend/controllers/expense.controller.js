import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as expenseService from '../services/expense.service.js';
import * as expenseCategoryRepository from '../repositories/expenseCategory.repository.js';

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await expenseCategoryRepository.findAllActive(req.user.tenantId);
  return success(res, { data: categories });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await expenseService.listExpenses(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpense(Number(req.params.id), req.user.tenantId);
  return success(res, { data: expense });
});

export const create = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.body, req.user.id, req.user);
  return success(res, { message: 'Expense recorded', data: expense, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(Number(req.params.id), req.body, req.user.id, req.user);
  return success(res, { message: 'Expense updated', data: expense });
});

export const remove = asyncHandler(async (req, res) => {
  await expenseService.deleteExpense(Number(req.params.id), req.user.id, req.user);
  return success(res, { message: 'Expense deleted' });
});
