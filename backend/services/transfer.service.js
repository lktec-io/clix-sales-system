import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as transferRepository from '../repositories/transfer.repository.js';
import * as inventoryRepository from '../repositories/inventory.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as productRepository from '../repositories/product.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';

async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

async function assertTransferAccess(user, transfer) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds === null) return;
  if (!branchIds.includes(transfer.source_branch_id) && !branchIds.includes(transfer.destination_branch_id)) {
    throw new ApiError(403, 'You do not have access to this transfer');
  }
}

export async function listTransfers(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);

  const { rows, total } = await transferRepository.findAll({
    tenantId: user.tenantId,
    page,
    limit,
    search: query.search,
    status: query.status,
    branchId: query.branchId ? Number(query.branchId) : undefined,
    branchIds,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getTransfer(id, tenantId) {
  const transfer = await transferRepository.findById(id, tenantId);
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  return transfer;
}

// Creating a transfer only reserves a request — no stock moves yet. It is
// still wrapped in its own transaction (header + every line item) so a
// partial request can never exist, even though recordMovement() isn't
// involved until approval.
export async function createTransfer(data, actorId, user) {
  if (Number(data.sourceBranchId) === Number(data.destinationBranchId)) {
    throw new ApiError(400, 'Source and destination branch must be different');
  }

  const sourceBranch = await branchRepository.findById(data.sourceBranchId, user.tenantId);
  if (!sourceBranch) throw new ApiError(400, 'Source branch does not exist');

  const destinationBranch = await branchRepository.findById(data.destinationBranchId, user.tenantId);
  if (!destinationBranch) throw new ApiError(400, 'Destination branch does not exist');

  await assertBranchAccess(user, data.sourceBranchId);

  if (!data.items?.length) throw new ApiError(400, 'Add at least one product to the transfer');

  for (const item of data.items) {
    const product = await productRepository.findById(item.productId, user.tenantId);
    if (!product) throw new ApiError(400, `Product ${item.productId} does not exist`);

    const available = await inventoryRepository.getAvailableQuantity(item.productId, data.sourceBranchId, user.tenantId);
    if (item.quantity > available) {
      throw new ApiError(422, `Cannot transfer more than available stock for "${product.name}" (available: ${available})`);
    }
  }

  const transferNumber = await generateCode('TRANSFER', 'TRF', { tenantId: user.tenantId, padLength: 6 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const transferId = await transferRepository.createRequest(
      { tenantId: user.tenantId, transferNumber, sourceBranchId: data.sourceBranchId, destinationBranchId: data.destinationBranchId, requestedBy: actorId },
      connection,
    );

    for (const item of data.items) {
      await transferRepository.createItem({ transferId, productId: item.productId, quantity: item.quantity }, connection);
    }

    await connection.commit();

    await activityLogRepository.create({
      tenantId: user.tenantId,
      userId: actorId,
      branchId: data.sourceBranchId,
      description: `Transfer "${transferNumber}" requested from "${sourceBranch.name}" to "${destinationBranch.name}"`,
      referenceType: 'stock_transfer_request',
      referenceId: transferId,
    });

    return transferRepository.findById(transferId, user.tenantId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Approval is the moment stock actually moves. Both branches update inside
// one transaction — a transfer_out at the source and a transfer_in at the
// destination for every line item, both calling the same recordMovement()
// used by Purchases, sharing this transaction's connection — so an approved
// transfer can never leave stock deducted from one branch without landing at
// the other.
export async function approveTransfer(id, actorId, user) {
  const transfer = await transferRepository.findById(id, user.tenantId);
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  if (transfer.status !== 'pending') throw new ApiError(400, 'Only pending transfers can be approved');

  await assertTransferAccess(user, transfer);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const lowStockCrossings = [];

    for (const item of transfer.items) {
      const outMovement = await inventoryRepository.recordMovement(
        {
          tenantId: user.tenantId,
          productId: item.product_id,
          branchId: transfer.source_branch_id,
          movementType: 'transfer_out',
          quantityChange: -item.quantity,
          referenceType: 'stock_transfer_request',
          referenceId: transfer.id,
          userId: actorId,
        },
        connection,
      );

      if (outMovement.crossedIntoLowStock) {
        lowStockCrossings.push({
          productId: item.product_id, productName: item.product_name, newStock: outMovement.newStock, minStock: outMovement.minStock,
        });
      }

      await inventoryRepository.recordMovement(
        {
          tenantId: user.tenantId,
          productId: item.product_id,
          branchId: transfer.destination_branch_id,
          movementType: 'transfer_in',
          quantityChange: item.quantity,
          referenceType: 'stock_transfer_request',
          referenceId: transfer.id,
          userId: actorId,
        },
        connection,
      );
    }

    const updated = await transferRepository.setStatus({ id, status: 'approved', approvedBy: actorId }, connection);
    if (!updated) throw new ApiError(409, 'Transfer was already processed');

    await connection.commit();

    await activityLogRepository.create({
      tenantId: user.tenantId,
      userId: actorId,
      branchId: transfer.destination_branch_id,
      description: `Transfer "${transfer.transfer_number}" approved: stock moved from "${transfer.source_branch_name}" to "${transfer.destination_branch_name}"`,
      referenceType: 'stock_transfer_request',
      referenceId: id,
    });

    await notificationRepository.notifyBranchManagement(user.tenantId, transfer.destination_branch_id, {
      type: 'success',
      category: 'transfer_completed',
      title: 'Transfer completed',
      message: `Transfer "${transfer.transfer_number}" completed: stock moved from "${transfer.source_branch_name}" to "${transfer.destination_branch_name}"`,
      referenceType: 'stock_transfer_request',
      referenceId: id,
    });

    for (const crossing of lowStockCrossings) {
      await notificationRepository.notifyBranchManagement(user.tenantId, transfer.source_branch_id, {
        type: 'warning',
        category: 'low_stock',
        title: 'Low stock alert',
        message: `"${crossing.productName}" at "${transfer.source_branch_name}" has dropped to ${crossing.newStock} units (threshold: ${crossing.minStock})`,
        referenceType: 'product',
        referenceId: crossing.productId,
      });
    }

    return transferRepository.findById(id, user.tenantId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function rejectTransfer(id, actorId, user) {
  const transfer = await transferRepository.findById(id, user.tenantId);
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  if (transfer.status !== 'pending') throw new ApiError(400, 'Only pending transfers can be rejected');

  await assertTransferAccess(user, transfer);

  const updated = await transferRepository.setStatus({ id, status: 'rejected', approvedBy: actorId });
  if (!updated) throw new ApiError(409, 'Transfer was already processed');

  await activityLogRepository.create({
    tenantId: user.tenantId,
    userId: actorId,
    branchId: transfer.source_branch_id,
    description: `Transfer "${transfer.transfer_number}" rejected`,
    referenceType: 'stock_transfer_request',
    referenceId: id,
  });

  return transferRepository.findById(id, user.tenantId);
}
