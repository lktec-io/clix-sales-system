import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as loanService from '../services/loan.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await loanService.listLoans(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const loan = await loanService.getLoan(Number(req.params.id), req.user.tenantId);
  return success(res, { data: loan });
});

export const apply = asyncHandler(async (req, res) => {
  const loan = await loanService.applyForLoan(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan application submitted', data: loan, status: 201 });
});

export const markUnderReview = asyncHandler(async (req, res) => {
  const loan = await loanService.markUnderReview(Number(req.params.id), req.user.tenantId);
  return success(res, { message: 'Loan moved to review', data: loan });
});

export const approve = asyncHandler(async (req, res) => {
  const loan = await loanService.approveLoan(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan approved', data: loan });
});

export const reject = asyncHandler(async (req, res) => {
  const loan = await loanService.rejectLoan(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan rejected', data: loan });
});

export const disburse = asyncHandler(async (req, res) => {
  const loan = await loanService.disburseLoan(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan disbursed', data: loan });
});

export const writeOff = asyncHandler(async (req, res) => {
  const loan = await loanService.writeOffLoan(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan written off', data: loan });
});

export const addGuarantor = asyncHandler(async (req, res) => {
  const guarantors = await loanService.addGuarantor(Number(req.params.id), req.body, req.user.tenantId);
  return success(res, { message: 'Guarantor added', data: guarantors, status: 201 });
});

export const portfolioKpis = asyncHandler(async (req, res) => {
  const kpis = await loanService.getPortfolioKpis(req.user);
  return success(res, { data: kpis });
});
