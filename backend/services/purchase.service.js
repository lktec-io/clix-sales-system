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
export async function createPurchase(data, actorId, tenantId) {
  const supplier = await supplierRepository.findById(data.supplierId, tenantId);
  if (!supplier) throw new ApiError(400, 'Selected supplier does not exist');

  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');

  if (!data.items?.length) throw new ApiError(400, 'Add at least one product to the purchase');

  for (const item of data.items) {
    const product = await productRepository.findById(item.productId, tenantId);
    if (!product) throw new ApiError(400, `Product ${item.productId} does not exist`);
  }

  const purchaseNumber = await generateCode('PURCHASE', 'PUR', { tenantId, padLength: 6 });
  const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.buyingPrice, 0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const orderId = await purchaseRepository.createOrder(
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
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function addPayment(data, actorId, tenantId) {
  const supplier = await supplierRepository.findById(data.supplierId, tenantId);
  if (!supplier) throw new ApiError(404, 'Supplier not found');

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
