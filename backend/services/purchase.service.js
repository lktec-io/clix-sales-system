import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
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
