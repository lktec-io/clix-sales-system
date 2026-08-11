import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as repairRepository from '../repositories/repair.repository.js';
import * as productRepository from '../repositories/product.repository.js';
import * as inventoryRepository from '../repositories/inventory.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// One authoritative state machine — every transition below is checked
// against this map first. CANCELLED is reachable from any non-terminal
// state; REJECTED only follows a customer declining the estimate;
// UNREPAIRABLE only follows a technician's diagnosis finding the device
// can't be fixed. No status is ever accepted directly from a request body.
const ALLOWED_TRANSITIONS = {
  received: ['diagnosis', 'cancelled'],
  diagnosis: ['waiting_approval', 'unrepairable', 'cancelled'],
  waiting_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['in_repair', 'cancelled'],
  in_repair: ['ready_for_collection', 'cancelled'],
  ready_for_collection: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: [],
  unrepairable: [],
};

async function assertTransition(id, tenantId, toStatus) {
  const repair = await repairRepository.findById(id, tenantId);
  if (!repair) throw new ApiError(404, 'Repair not found');
  if (!ALLOWED_TRANSITIONS[repair.status]?.includes(toStatus)) {
    throw new ApiError(400, `Cannot move repair from "${repair.status}" to "${toStatus}"`);
  }
  return repair;
}

// user.repository.js#findById is deliberately NOT tenant-scoped (it's also
// used by login, before a tenant is known) — every caller here must check
// tenant_id itself rather than trust the row belongs to the caller's tenant.
async function findTenantUser(userId, tenantId) {
  const user = await userRepository.findById(userId);
  if (!user || user.tenant_id !== tenantId) return null;
  return user;
}

export async function listRepairs(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);
  const { rows, total } = await repairRepository.findAll({
    tenantId: user.tenantId, page, limit, search: query.search, status: query.status,
    deviceType: query.deviceType, branchId: query.branchId ? Number(query.branchId) : undefined,
    dateFrom: query.dateFrom, dateTo: query.dateTo, branchIds,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getRepair(id, tenantId) {
  const repair = await repairRepository.findById(id, tenantId);
  if (!repair) throw new ApiError(404, 'Repair not found');
  return repair;
}

export async function createIntake(data, actorId, tenantId) {
  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');

  const customer = await customerRepository.findById(data.customerId, tenantId);
  if (!customer) throw new ApiError(400, 'Selected customer does not exist');

  if (data.technicianId) {
    const technician = await findTenantUser(data.technicianId, tenantId);
    if (!technician) throw new ApiError(400, 'Selected technician does not exist');
  }

  const repairNumber = await generateCode('REPAIR', 'REP', { tenantId, padLength: 6, includeYear: true });

  const connection = await pool.getConnection();
  let repairId;
  try {
    await connection.beginTransaction();
    repairId = await repairRepository.create({ ...data, tenantId, repairNumber, createdBy: actorId }, connection);
    if (data.technicianId) {
      await repairRepository.update(repairId, tenantId, { technicianId: data.technicianId }, connection);
    }
    // No initial history row here — the repair is created with status
    // 'received' (the table's own DEFAULT) and received_at already
    // captures that moment; repair_status_history starts recording from
    // the first real transition onward (see transitionStatus()'s
    // affectedRows-based optimistic lock, which can't represent a
    // same-to-same "transition" since MySQL doesn't count a no-op UPDATE
    // as an affected row).
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: data.branchId,
    description: `Repair "${repairNumber}" opened for ${data.brand} ${data.model}`,
    referenceType: 'repair', referenceId: repairId,
  });

  return repairRepository.findById(repairId, tenantId);
}

// Diagnosis notes + estimated labor charge can be recorded any time before
// the repair is sent for customer approval — a plain data update, not a
// status transition, so technicians can revise their notes as they work.
export async function updateDiagnosis(id, data, actorId, tenantId) {
  const repair = await getRepair(id, tenantId);
  if (!['received', 'diagnosis'].includes(repair.status)) {
    throw new ApiError(400, 'Diagnosis can only be recorded before the repair is sent for approval');
  }
  await repairRepository.update(id, tenantId, {
    diagnosis: data.diagnosis, repairNotes: data.repairNotes, laborCharge: data.laborCharge,
  });
  if (data.laborCharge !== undefined) {
    await repairRepository.recalculateTotals(id);
  }
  return getRepair(id, tenantId);
}

export async function assignTechnician(id, technicianId, actorId, tenantId) {
  await getRepair(id, tenantId);
  const technician = await findTenantUser(technicianId, tenantId);
  if (!technician) throw new ApiError(400, 'Selected technician does not exist');
  await repairRepository.update(id, tenantId, { technicianId });
  return getRepair(id, tenantId);
}

export async function startDiagnosis(id, actorId, tenantId) {
  await assertTransition(id, tenantId, 'diagnosis');
  const moved = await repairRepository.transitionStatus(id, tenantId, ['received'], 'diagnosis', actorId, null);
  if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
  return getRepair(id, tenantId);
}

export async function sendForApproval(id, actorId, tenantId) {
  const repair = await assertTransition(id, tenantId, 'waiting_approval');
  if (!repair.diagnosis) throw new ApiError(400, 'Record a diagnosis before sending for customer approval');
  const moved = await repairRepository.transitionStatus(id, tenantId, ['diagnosis'], 'waiting_approval', actorId, null);
  if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
  return getRepair(id, tenantId);
}

export async function markUnrepairable(id, notes, actorId, tenantId) {
  await assertTransition(id, tenantId, 'unrepairable');
  const moved = await repairRepository.transitionStatus(id, tenantId, ['diagnosis'], 'unrepairable', actorId, notes);
  if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
  return getRepair(id, tenantId);
}

export async function approve(id, actorId, tenantId) {
  await assertTransition(id, tenantId, 'approved');
  const moved = await repairRepository.transitionStatus(id, tenantId, ['waiting_approval'], 'approved', actorId, 'Customer approved the estimate');
  if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
  return getRepair(id, tenantId);
}

export async function reject(id, notes, actorId, tenantId) {
  await assertTransition(id, tenantId, 'rejected');
  const moved = await repairRepository.transitionStatus(id, tenantId, ['waiting_approval'], 'rejected', actorId, notes || 'Customer declined the estimate');
  if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
  return getRepair(id, tenantId);
}

export async function startRepair(id, actorId, tenantId) {
  await assertTransition(id, tenantId, 'in_repair');
  const moved = await repairRepository.transitionStatus(id, tenantId, ['approved'], 'in_repair', actorId, null);
  if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
  return getRepair(id, tenantId);
}

// Parts always come from the tenant's own existing Products/Inventory —
// stock, cost, and selling price are all read from the trusted server-side
// product record, never from the request body. Stock is deducted through
// inventoryRepository.recordMovement(), the exact same row-locked,
// transaction-safe function POS checkout already uses (movementType
// 'repair' — see 034's ALTER TABLE — keeps repair consumption honestly
// distinct from a retail sale in reports/history).
export async function addPart(id, data, actorId, tenantId) {
  const repair = await getRepair(id, tenantId);
  if (repair.status !== 'in_repair') {
    throw new ApiError(400, 'Parts can only be recorded while the repair is in progress');
  }
  const quantity = Number(data.quantity);
  if (!(quantity > 0)) throw new ApiError(400, 'Quantity must be greater than zero');

  const product = await productRepository.findById(data.productId, tenantId);
  if (!product) throw new ApiError(400, 'Selected product does not exist');

  const available = await inventoryRepository.getAvailableQuantity(data.productId, repair.branch_id, tenantId);
  if (quantity > available) {
    throw new ApiError(422, `Cannot use more than available stock for "${product.name}" (available: ${available})`);
  }

  const unitCost = Number(product.buying_price);
  const unitPrice = Number(product.selling_price);
  const lineTotal = round2(unitPrice * quantity);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await inventoryRepository.recordMovement({
      tenantId, productId: data.productId, branchId: repair.branch_id,
      movementType: 'repair', quantityChange: -quantity,
      referenceType: 'repair', referenceId: id, userId: actorId,
    }, connection);
    await repairRepository.createPart({
      repairId: id, productId: data.productId, branchId: repair.branch_id, quantity, unitCost, unitPrice, lineTotal,
    }, connection);
    await repairRepository.recalculateTotals(id, connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return getRepair(id, tenantId);
}

export async function markReady(id, actorId, tenantId) {
  await assertTransition(id, tenantId, 'ready_for_collection');
  const moved = await repairRepository.transitionStatus(id, tenantId, ['in_repair'], 'ready_for_collection', actorId, null);
  if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
  return getRepair(id, tenantId);
}

// Partial payments are supported at any non-terminal status (a customer
// may pay a deposit at approval time, then settle the balance at
// collection) — this is a data operation, not a lifecycle transition, so
// it isn't gated by ALLOWED_TRANSITIONS the way status changes are.
export async function recordPayment(id, data, actorId, tenantId) {
  const repair = await getRepair(id, tenantId);
  if (['cancelled', 'rejected', 'unrepairable'].includes(repair.status)) {
    throw new ApiError(400, 'Cannot record a payment on a cancelled, rejected, or unrepairable job');
  }
  const amount = Number(data.amount);
  if (!(amount > 0)) throw new ApiError(400, 'Amount must be greater than zero');
  if (!['cash', 'mobile_money', 'bank_transfer', 'card', 'other'].includes(data.paymentMethod)) {
    throw new ApiError(400, 'Invalid payment method');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await repairRepository.createPayment({ repairId: id, amount, paymentMethod: data.paymentMethod, receivedBy: actorId }, connection);
    await repairRepository.addPaidAmount(id, amount, connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: repair.branch_id,
    description: `Payment of ${formatCurrency(amount)} recorded on repair "${repair.repair_number}"`,
    referenceType: 'repair', referenceId: id,
  });

  return getRepair(id, tenantId);
}

export async function completeCollection(id, actorId, tenantId) {
  await assertTransition(id, tenantId, 'completed');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const moved = await repairRepository.transitionStatus(id, tenantId, ['ready_for_collection'], 'completed', actorId, 'Device collected', connection);
    if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
    await connection.query('UPDATE repairs SET completed_at = NOW() WHERE id = ?', [id]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
  return getRepair(id, tenantId);
}

export async function cancelRepair(id, notes, actorId, tenantId) {
  const repair = await getRepair(id, tenantId);
  if (!ALLOWED_TRANSITIONS[repair.status]?.includes('cancelled')) {
    throw new ApiError(400, `Cannot cancel a repair that is already "${repair.status}"`);
  }
  const moved = await repairRepository.transitionStatus(id, tenantId, [repair.status], 'cancelled', actorId, notes);
  if (!moved) throw new ApiError(409, 'Repair was already moved by someone else — please refresh');
  return getRepair(id, tenantId);
}

export async function getDashboardSummary(user) {
  const branchIds = await getAccessibleBranchIds(user);
  return repairRepository.getDashboardSummary(user.tenantId, branchIds);
}

export async function getRecentRepairs(user, limit = 5) {
  const branchIds = await getAccessibleBranchIds(user);
  return repairRepository.findRecent(user.tenantId, branchIds, limit);
}

export async function getCustomerRepairHistory(customerId, tenantId) {
  return repairRepository.findByCustomer(customerId, tenantId);
}
