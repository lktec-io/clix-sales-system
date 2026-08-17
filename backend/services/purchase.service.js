import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../config/logger.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as purchaseRepository from '../repositories/purchase.repository.js';
import * as inventoryRepository from '../repositories/inventory.repository.js';
import * as supplierRepository from '../repositories/supplier.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as productRepository from '../repositories/product.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

// Mirrors the identical private helper already duplicated in
// sale.service.js/expense.service.js/inventory.service.js/return.service.js/
// transfer.service.js — every other branch-owned mutation in this codebase
// checks this before writing; purchases had no such check at all, meaning
// a Manager/Cashier restricted to one branch could submit any branchId
// belonging to their own tenant and have stock silently incremented there.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

export async function listPurchases(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);

  const { rows, total } = await purchaseRepository.findAll({
    tenantId: user.tenantId,
    page, limit, search: query.search,
    supplierId: query.supplierId ? Number(query.supplierId) : undefined,
    branchId: query.branchId ? Number(query.branchId) : undefined,
    status: query.status,
    branchIds,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getPurchase(id, tenantId) {
  const purchase = await purchaseRepository.findById(id, tenantId);
  if (!purchase) throw new ApiError(404, 'Purchase not found');
  return purchase;
}

// The whole operation — order header, every line item, and every stock
// movement — is one all-or-nothing transaction. If anything fails partway
// (a bad product ID on line 3 of 5, a DB hiccup), everything rolls back:
// no partial purchase, no partial stock increment. recordMovement() is
// passed this transaction's own connection so it participates in the same
// unit of work instead of committing independently.
export async function createPurchase(data, actorId, tenantId, user) {
  const supplier = await supplierRepository.findById(data.supplierId, tenantId);
  if (!supplier) throw new ApiError(400, 'Selected supplier does not exist');

  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, data.branchId);

  if (!data.items?.length) throw new ApiError(400, 'Add at least one product to the purchase');

  for (const item of data.items) {
    const product = await productRepository.findById(item.productId, tenantId);
    if (!product) throw new ApiError(400, `Product ${item.productId} does not exist`);
  }

  const purchaseNumber = await generateCode('PURCHASE', 'PUR', { tenantId, padLength: 6 });
  const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.buyingPrice, 0);

  const connection = await pool.getConnection();
  let orderId;
  try {
    await connection.beginTransaction();

    orderId = await purchaseRepository.createOrder(
      { tenantId, purchaseNumber, supplierId: data.supplierId, branchId: data.branchId, totalAmount, userId: actorId },
      connection,
    );

    for (const item of data.items) {
      const lineTotal = item.quantity * item.buyingPrice;
      await purchaseRepository.createItem(
        { purchaseOrderId: orderId, productId: item.productId, quantity: item.quantity, buyingPrice: item.buyingPrice, lineTotal },
        connection,
      );

      await inventoryRepository.recordMovement(
        {
          tenantId,
          productId: item.productId,
          branchId: data.branchId,
          movementType: 'purchase',
          quantityChange: item.quantity,
          referenceType: 'purchase_order',
          referenceId: orderId,
          userId: actorId,
        },
        connection,
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // Deliberately outside the transaction's try/catch/finally above — the
  // purchase itself already committed by this point. A failure writing the
  // activity feed, firing a notification, or re-reading the row for the
  // response must never call rollback() on an already-committed connection,
  // and must never report an already-successful purchase as a failure.
  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: data.branchId,
    description: `Purchase "${purchaseNumber}" received from "${supplier.name}"`,
    referenceType: 'purchase_order',
    referenceId: orderId,
  });

  await notificationRepository.notifyBranchManagement(tenantId, data.branchId, {
    type: 'success',
    category: 'purchase_completed',
    title: 'Purchase received',
    message: `Purchase "${purchaseNumber}" (${formatCurrency(totalAmount)}) received from "${supplier.name}" at "${branch.name}"`,
    referenceType: 'purchase_order',
    referenceId: orderId,
  });

  return purchaseRepository.findById(orderId, tenantId);
}

// True hard delete: authenticate/authorize/branch-access are all enforced
// by the caller (route middleware + assertBranchAccess below) before this
// ever runs; ownership is re-derived from `purchase.branch_id` (the
// database's own record), never from a client-supplied value.
//
// Reverses the purchase's own stock effect by reusing
// inventoryRepository.recordMovement() — the exact same row-locked
// function every other stock-changing operation in this codebase already
// goes through, not a second, competing inventory mechanism. Its existing
// negative-stock guard is what actually decides whether this delete is
// safe: if any line item's product has since been partially or fully
// sold/transferred elsewhere (current stock is now less than what this
// purchase added), recordMovement() throws before anything commits, the
// whole transaction rolls back, and the caller sees a clear explanation
// instead of a corrupted stock count.
export async function deletePurchase(id, actorId, tenantId, user) {
  const purchase = await purchaseRepository.findById(id, tenantId);
  if (!purchase) throw new ApiError(404, 'Purchase not found');
  await assertBranchAccess(user, purchase.branch_id);

  const hasPayments = await purchaseRepository.hasPayments(id, tenantId);
  if (hasPayments) {
    throw new ApiError(409, `Cannot delete purchase "${purchase.purchase_number}" — it has recorded supplier payments. Remove those payments first.`);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of purchase.items) {
      // A purchase item whose product was itself later hard-deleted keeps
      // only a name/price snapshot (product_id is NULL by then) — nothing
      // live left to reverse stock against, so it's skipped, not an error.
      if (item.product_id) {
        await inventoryRepository.recordMovement({
          tenantId, productId: item.product_id, branchId: purchase.branch_id,
          movementType: 'manual_correction', quantityChange: -item.quantity,
          referenceType: 'purchase_order_deleted', referenceId: id, userId: actorId,
        }, connection);
      }
    }

    await purchaseRepository.hardDelete(id, tenantId, connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    if (err instanceof ApiError && err.status === 422) {
      throw new ApiError(409, `Cannot delete purchase "${purchase.purchase_number}" — some of the stock it added has already been sold, transferred, or otherwise used. Deleting it would make your inventory incorrect.`);
    }
    // Any other failure here is unexpected (a DB-level constraint, a
    // connection drop mid-transaction, etc.) — the rollback above already
    // guarantees nothing partial was committed. Rather than let a raw
    // driver error reach errorHandler.js as a bare 500 with no purchase
    // context, log the full diagnostic detail (SQL error code included)
    // here where we still know exactly which purchase/tenant/step failed,
    // then hand the client a clear, safe explanation instead of a stack
    // trace.
    logger.error('Purchase hard delete failed unexpectedly', {
      purchaseId: id,
      tenantId,
      actorId,
      errMessage: err.message,
      errCode: err.code,
      errErrno: err.errno,
      sqlMessage: err.sqlMessage,
    });
    if (err instanceof ApiError) throw err;
    throw new ApiError(409, `Cannot delete purchase "${purchase.purchase_number}" right now — an unexpected error occurred. No changes were made. Please try again or contact support if this continues.`);
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: purchase.branch_id,
    description: `Purchase "${purchase.purchase_number}" (${formatCurrency(purchase.total_amount)}) permanently deleted — stock additions reversed`,
    referenceType: 'purchase_order',
    referenceId: id,
  });
}

export async function addPayment(data, actorId, tenantId) {
  const supplier = await supplierRepository.findById(data.supplierId, tenantId);
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  // Without this, a purchaseOrderId belonging to ANOTHER tenant (or a
  // different supplier within the same tenant) could be passed straight
  // through to the repository, creating a supplier_payments row whose
  // purchase_order_id FK points at data that doesn't belong to either the
  // caller's tenant or the supplier being paid.
  if (data.purchaseOrderId) {
    const purchaseOrder = await purchaseRepository.findById(data.purchaseOrderId, tenantId);
    if (!purchaseOrder) throw new ApiError(400, 'Selected purchase order does not exist');
    if (Number(purchaseOrder.supplier_id) !== Number(data.supplierId)) {
      throw new ApiError(400, 'Selected purchase order does not belong to this supplier');
    }
  }

  await purchaseRepository.addPayment({
    supplierId: data.supplierId,
    purchaseOrderId: data.purchaseOrderId || null,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    paidAt: data.paidAt || new Date(),
    userId: actorId,
  });

  await activityLogRepository.create({
    tenantId,
    userId: actorId,
    branchId: null,
    description: `Payment recorded for supplier "${supplier.name}"`,
    referenceType: 'supplier_payment',
    referenceId: data.supplierId,
  });
}
