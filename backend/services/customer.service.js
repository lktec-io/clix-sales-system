import { ApiError } from '../utils/apiError.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

export async function listCustomers(query, tenantId) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await customerRepository.findAll({
    tenantId, page, limit, search: query.search, customerType: query.customerType, status: query.status,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// Purchase/return history and lifetime stats are real queries against the
// `sales`/`returns` tables — those tables exist from Phase 0 but have no
// rows until Phases 17/18 ship, so this correctly returns empty/zero today
// and "lights up" automatically once POS and Returns are built, with no
// rework needed here.
export async function getCustomer(id, tenantId) {
  const customer = await customerRepository.findById(id, tenantId);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const stats = await customerRepository.getStatistics(id, tenantId);
  return { ...customer, ...stats };
}

export async function getPurchaseHistory(id, query, tenantId) {
  const customer = await customerRepository.findById(id, tenantId);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await customerRepository.findPurchaseHistory(id, tenantId, { page, limit });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getReturnHistory(id, query, tenantId) {
  const customer = await customerRepository.findById(id, tenantId);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await customerRepository.findReturnHistory(id, tenantId, { page, limit });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function createCustomer(data, actorId, tenantId) {
  // Checked BEFORE generateCode() — generateCode() atomically consumes the
  // next CUST-NNNN number the moment it's called, so a duplicate-phone
  // attempt that only fails afterward (at the repository INSERT's UNIQUE
  // constraint) still permanently burns that number, producing gaps in the
  // sequence after far fewer real customers. This also gives a specific,
  // friendly message instead of the generic 409 the raw DB constraint
  // violation would otherwise surface as.
  const existing = await customerRepository.findByPhone(data.phone, tenantId);
  if (existing) throw new ApiError(409, 'A customer with this phone number already exists');

  // includeYear: false + padLength 4 -> "CUST-0001", not "CUST-2026-00001"
  // — a shorter code a cashier can read aloud without the year segment
  // reading as a typo or an odd artifact.
  const customerCode = await generateCode('CUSTOMER', 'CUST', { tenantId, padLength: 4, includeYear: false });
  const customer = await customerRepository.create({ ...data, tenantId, customerCode, userId: actorId });

  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Customer "${customerCode}" (${customer.first_name} ${customer.last_name}) created`,
    referenceType: 'customer',
    referenceId: customer.id,
  });

  return customer;
}

export async function updateCustomer(id, data, actorId, tenantId) {
  const existing = await customerRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Customer not found');

  if (data.phone) {
    const phoneConflict = await customerRepository.findByPhone(data.phone, tenantId, id);
    if (phoneConflict) throw new ApiError(409, 'A customer with this phone number already exists');
  }

  const customer = await customerRepository.update(id, tenantId, { ...data, userId: actorId });

  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Customer "${customer.customer_code}" updated`,
    referenceType: 'customer',
    referenceId: id,
  });

  return customer;
}

export async function changeStatus(id, status, actorId, tenantId) {
  const existing = await customerRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Customer not found');

  const customer = await customerRepository.updateStatus(id, tenantId, status, actorId);

  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Customer "${existing.customer_code}" status changed to ${status}`,
    referenceType: 'customer',
    referenceId: id,
  });

  return customer;
}

export async function deleteCustomer(id, actorId, tenantId) {
  const existing = await customerRepository.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Customer not found');

  try {
    await customerRepository.hardDelete(id, tenantId);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      throw new ApiError(409, 'Cannot delete this customer — related records still reference them.');
    }
    throw err;
  }

  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Customer "${existing.customer_code}" (${existing.first_name} ${existing.last_name}) permanently deleted`,
    referenceType: 'customer',
    referenceId: id,
  });
}
