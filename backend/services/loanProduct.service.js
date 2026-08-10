import { ApiError } from '../utils/apiError.js';
import * as loanProductRepository from '../repositories/loanProduct.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listLoanProducts(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await loanProductRepository.findAll({
    tenantId: user.tenantId, page, limit, search: query.search, status: query.status,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getLoanProduct(id, tenantId) {
  const product = await loanProductRepository.findById(id, tenantId);
  if (!product) throw new ApiError(404, 'Loan product not found');
  return product;
}

function validateRange(data) {
  if (Number(data.minAmount) <= 0) throw new ApiError(400, 'Minimum amount must be greater than zero');
  if (Number(data.maxAmount) < Number(data.minAmount)) throw new ApiError(400, 'Maximum amount must be greater than or equal to the minimum amount');
  if (Number(data.interestRate) < 0) throw new ApiError(400, 'Interest rate cannot be negative');
  if (Number(data.durationValue) <= 0) throw new ApiError(400, 'Duration must be greater than zero');
}

export async function createLoanProduct(data, userId, tenantId) {
  validateRange(data);
  const product = await loanProductRepository.create({ ...data, tenantId, userId });
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Loan product "${product.name}" created`,
    referenceType: 'loan_product', referenceId: product.id,
  });
  return product;
}

export async function updateLoanProduct(id, data, userId, tenantId) {
  await getLoanProduct(id, tenantId);
  validateRange(data);
  const product = await loanProductRepository.update(id, tenantId, { ...data, userId });
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Loan product "${product.name}" updated`,
    referenceType: 'loan_product', referenceId: product.id,
  });
  return product;
}

export async function setLoanProductStatus(id, status, userId, tenantId) {
  const existing = await getLoanProduct(id, tenantId);
  const product = await loanProductRepository.updateStatus(id, tenantId, status, userId);
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Loan product "${existing.name}" ${status === 'active' ? 'activated' : 'deactivated'}`,
    referenceType: 'loan_product', referenceId: id,
  });
  return product;
}

export async function deleteLoanProduct(id, userId, tenantId) {
  const existing = await getLoanProduct(id, tenantId);
  const loansUsingIt = await loanProductRepository.countLoansUsingProduct(id, tenantId);
  if (loansUsingIt > 0) {
    throw new ApiError(400, 'This loan product has existing loans and cannot be deleted — deactivate it instead');
  }
  await loanProductRepository.softDelete(id, tenantId);
  await activityLogRepository.create({
    tenantId, userId, branchId: null,
    description: `Loan product "${existing.name}" deleted`,
    referenceType: 'loan_product', referenceId: id,
  });
}
