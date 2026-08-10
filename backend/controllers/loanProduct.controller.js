import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as loanProductService from '../services/loanProduct.service.js';
import * as loanProductRepository from '../repositories/loanProduct.repository.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await loanProductService.listLoanProducts(req.query, req.user);
  return success(res, { data: { items, meta } });
});

export const listActive = asyncHandler(async (req, res) => {
  const products = await loanProductRepository.findAllActive(req.user.tenantId);
  return success(res, { data: products });
});

export const getById = asyncHandler(async (req, res) => {
  const product = await loanProductService.getLoanProduct(Number(req.params.id), req.user.tenantId);
  return success(res, { data: product });
});

export const create = asyncHandler(async (req, res) => {
  const product = await loanProductService.createLoanProduct(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan product created', data: product, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const product = await loanProductService.updateLoanProduct(Number(req.params.id), req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan product updated', data: product });
});

export const setStatus = asyncHandler(async (req, res) => {
  const product = await loanProductService.setLoanProductStatus(Number(req.params.id), req.body.status, req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan product status updated', data: product });
});

export const remove = asyncHandler(async (req, res) => {
  await loanProductService.deleteLoanProduct(Number(req.params.id), req.user.id, req.user.tenantId);
  return success(res, { message: 'Loan product deleted' });
});
