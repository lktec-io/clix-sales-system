import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as returnRepository from '../repositories/return.repository.js';
import * as saleRepository from '../repositories/sale.repository.js';
import * as inventoryRepository from '../repositories/inventory.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

export async function listReturns(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);

  const { rows, total } = await returnRepository.findAll({
    tenantId: user.tenantId,
    page,
    limit,
    search: query.search,
    status: query.status,
    branchIds,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getReturn(id, tenantId) {
  const returnRecord = await returnRepository.findById(id, tenantId);
  if (!returnRecord) throw new ApiError(404, 'Return not found');
  return returnRecord;
}

// Creating a return only reserves the request — no stock or refund moves
// until a Manager/Super Admin approves it, the same two-step shape Transfers
// established in Phase 15.
export async function createReturn(data, actorId, user) {
  const sale = await saleRepository.findById(data.saleId, user.tenantId);
  if (!sale) throw new ApiError(400, 'Original sale does not exist');
  if (sale.status !== 'completed') throw new ApiError(400, 'Cannot return items from a voided sale');

  await assertBranchAccess(user, sale.branch_id);

  if (!data.items?.length) throw new ApiError(400, 'Select at least one item to return');

  let refundAmount = 0;
  const preparedItems = [];

  for (const item of data.items) {
    const saleItem = sale.items.find((row) => row.id === item.saleItemId);
    if (!saleItem) throw new ApiError(400, `Item ${item.saleItemId} does not belong to this sale`);

    const alreadyReturned = await returnRepository.getReturnedQuantity(item.saleItemId);
    if (item.quantity + alreadyReturned > saleItem.quantity) {
      throw new ApiError(422, `Cannot return more than the sold quantity for "${saleItem.product_name}"`);
    }

    const unitRefund = Number(saleItem.line_total) / saleItem.quantity;
    refundAmount += unitRefund * item.quantity;
    preparedItems.push({ saleItemId: item.saleItemId, quantity: item.quantity });
  }

  const returnNumber = await generateCode('RETURN', 'RET', { tenantId: user.tenantId, padLength: 6 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const returnId = await returnRepository.createRequest(
      {
        tenantId: user.tenantId,
        returnNumber,
        saleId: sale.id,
        customerId: data.customerId || sale.customer_id,
        reason: data.reason,
        refundAmount: Math.round(refundAmount),
        refundMethod: data.refundMethod,
        createdBy: actorId,
      },
      connection,
    );

    for (const item of preparedItems) {
      await returnRepository.createItem({ returnId, saleItemId: item.saleItemId, quantity: item.quantity }, connection);
    }

    await connection.commit();

    await activityLogRepository.create({
      tenantId: user.tenantId,
      userId: actorId,
      branchId: sale.branch_id,
      description: `Return "${returnNumber}" requested against sale "${sale.sale_number}"`,
      referenceType: 'return',
      referenceId: returnId,
    });

    return returnRepository.findById(returnId, user.tenantId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Approval is the moment stock actually restocks and the refund is marked
// issued — one transaction, a recordMovement() per return line (movement
// type 'return', positive quantity change) sharing the connection with the
// status update, the same transactional shape Purchases/Transfers/POS use.
export async function approveReturn(id, actorId, user) {
  const returnRecord = await returnRepository.findById(id, user.tenantId);
  if (!returnRecord) throw new ApiError(404, 'Return not found');
  if (returnRecord.status !== 'pending') throw new ApiError(400, 'Only pending returns can be approved');

  await assertBranchAccess(user, returnRecord.branch_id);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of returnRecord.items) {
      // The product this line was for can have been permanently deleted
      // since the return was requested (see product.service.js's
      // deleteProduct) — its inventory row is gone along with it, so
      // there's nothing left to restock. The refund itself doesn't depend
      // on live product data (refund_amount is already fixed on the
      // return record), so approval still proceeds for every other line.
      if (!item.product_id) continue;

      await inventoryRepository.recordMovement(
        {
          tenantId: user.tenantId,
          productId: item.product_id,
          branchId: returnRecord.branch_id,
          movementType: 'return',
          quantityChange: item.quantity,
          referenceType: 'return',
          referenceId: returnRecord.id,
          userId: actorId,
        },
        connection,
      );
    }

    const updated = await returnRepository.setStatus(
      { id, status: 'approved', approvedBy: actorId, refundStatus: 'refunded' },
      connection,
    );
    if (!updated) throw new ApiError(409, 'Return was already processed');

    await connection.commit();

    await activityLogRepository.create({
      tenantId: user.tenantId,
      userId: actorId,
      branchId: returnRecord.branch_id,
      description: `Return "${returnRecord.return_number}" approved: stock restored, refund of ${formatCurrency(returnRecord.refund_amount)} issued`,
      referenceType: 'return',
      referenceId: id,
    });

    await notificationRepository.notifyBranchManagement(user.tenantId, returnRecord.branch_id, {
      type: 'info',
      category: 'return_processed',
      title: 'Return processed',
      message: `Return "${returnRecord.return_number}" approved against sale "${returnRecord.sale_number}" — refund of ${formatCurrency(returnRecord.refund_amount)} issued`,
      referenceType: 'return',
      referenceId: id,
    });

    return returnRepository.findById(id, user.tenantId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function rejectReturn(id, actorId, user) {
  const returnRecord = await returnRepository.findById(id, user.tenantId);
  if (!returnRecord) throw new ApiError(404, 'Return not found');
  if (returnRecord.status !== 'pending') throw new ApiError(400, 'Only pending returns can be rejected');

  await assertBranchAccess(user, returnRecord.branch_id);

  const updated = await returnRepository.setStatus({ id, status: 'rejected', approvedBy: actorId });
  if (!updated) throw new ApiError(409, 'Return was already processed');

  await activityLogRepository.create({
    tenantId: user.tenantId,
    userId: actorId,
    branchId: returnRecord.branch_id,
    description: `Return "${returnRecord.return_number}" rejected`,
    referenceType: 'return',
    referenceId: id,
  });

  return returnRepository.findById(id, user.tenantId);
}
