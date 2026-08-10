import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import * as loanService from '../services/loan.service.js';
import * as loanRepaymentRepository from '../repositories/loanRepayment.repository.js';

export const list = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(req.user);
  const { rows, total } = await loanRepaymentRepository.findAll({
    tenantId: req.user.tenantId, page, limit, search: req.query.search,
    loanId: req.query.loanId ? Number(req.query.loanId) : undefined, branchIds,
  });
  return success(res, { data: { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
});

export const create = asyncHandler(async (req, res) => {
  const repayment = await loanService.recordRepayment(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Repayment recorded', data: repayment, status: 201 });
});
