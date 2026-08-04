import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as saleRepository from '../repositories/sale.repository.js';
import * as inventoryRepository from '../repositories/inventory.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as productRepository from '../repositories/product.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as permissionRepository from '../repositories/permission.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

// Cashiers (sales.create only) may discount up to this fraction of a line
// or the cart without escalation — the spec's "Cashier: Limited Discount"
// tier. Anyone holding sales.manage ("Manager: Extended", "Super Admin:
// Full Authority") has no cap and may also override a line's unit price.
const UNAUTHORIZED_DISCOUNT_LIMIT = 0.1;

async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

async function hasDiscountAuthority(user) {
  const codes = await permissionRepository.getCodesForRole(user.roleId);
  return codes.includes('sales.manage');
}

export async function listSales(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);

  const { rows, total } = await saleRepository.findAll({
    tenantId: user.tenantId,
    page,
    limit,
    search: query.search,
    branchId: query.branchId ? Number(query.branchId) : undefined,
    customerId: query.customerId ? Number(query.customerId) : undefined,
    status: query.status,
    branchIds,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// Cost/profit isn't shown to every sales.view holder (a cashier ringing up
// this exact sale can view it) — gated behind the same sales.manage tier
// hasDiscountAuthority already checks for discount/price-override, since
// margin visibility is the same "manager-level" business rule.
function computeProfit(items) {
  const revenue = items.reduce((sum, item) => sum + Number(item.line_total), 0);
  const cost = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.buying_price), 0);
  const grossProfit = revenue - cost;
  return {
    revenue,
    cost,
    grossProfit,
    marginPercent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
  };
}

// Applied to every sale object this service hands back to a controller
// (getSale AND checkout's own return value — checkout used to return
// saleRepository.findById()'s raw row straight through, which still
// carried buying_price on every item regardless of who completed the
// sale) so cost/margin data can't leak to a cashier who only has
// sales.create by reading their own checkout response.
async function withProfitVisibility(sale, user) {
  const canSeeProfit = user ? await hasDiscountAuthority(user) : false;
  if (!canSeeProfit) {
    return { ...sale, items: sale.items.map(({ buying_price, ...item }) => item) };
  }
  return { ...sale, profit: computeProfit(sale.items) };
}

export async function getSale(id, tenantId, user) {
  const sale = await saleRepository.findById(id, tenantId);
  if (!sale) throw new ApiError(404, 'Sale not found');
  return withProfitVisibility(sale, user);
}

// The checkout transaction: validate cart, stock, customer and payment
// up front, then one all-or-nothing unit of work — sale header, every line
// item, every payment record, and a recordMovement() per line item
// decrementing stock — all sharing one connection. Third production
// consumer of Phase 10's composable design, after Purchases' single
// direction and Transfers' dual-branch pair.
export async function checkout(data, actorId, user) {
  // A resubmission (double-click before the button's disabled state took
  // effect, a retried network request, a second tab) carrying the same
  // client-generated key as one that already succeeded returns that sale
  // as-is rather than creating (and double-decrementing stock for) a
  // second one. Checked before any validation/transaction work, not
  // relied on as a last-resort UNIQUE-constraint catch, so a resubmission
  // never even re-runs the stock checks.
  if (data.idempotencyKey) {
    const existingSaleId = await saleRepository.findByIdempotencyKey(data.idempotencyKey, user.tenantId);
    if (existingSaleId) {
      return withProfitVisibility(await saleRepository.findById(existingSaleId, user.tenantId), user);
    }
  }

  const branchId = Number(data.branchId);
  const branch = await branchRepository.findById(branchId, user.tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, branchId);

  if (data.customerId) {
    const customer = await customerRepository.findById(data.customerId, user.tenantId);
    if (!customer) throw new ApiError(400, 'Selected customer does not exist');
  }

  if (!data.items?.length) throw new ApiError(400, 'Cart is empty');

  const canOverride = await hasDiscountAuthority(user);

  let subtotal = 0;
  let itemDiscountTotal = 0;
  const preparedItems = [];

  for (const item of data.items) {
    const product = await productRepository.findById(item.productId, user.tenantId);
    if (!product || product.status !== 'active') {
      throw new ApiError(400, `Product ${item.productId} is not available for sale`);
    }

    const unitPrice = Number(item.unitPrice);
    if (!canOverride && unitPrice !== Number(product.selling_price)) {
      throw new ApiError(403, `Price override for "${product.name}" requires manager approval`);
    }

    const available = await inventoryRepository.getAvailableQuantity(item.productId, branchId, user.tenantId);
    if (item.quantity > available) {
      throw new ApiError(422, `Cannot sell more than available stock for "${product.name}" (available: ${available})`);
    }

    const lineSubtotal = item.quantity * unitPrice;
    const discountAmount = Number(item.discountAmount) || 0;
    if (discountAmount > lineSubtotal) {
      throw new ApiError(422, `Discount for "${product.name}" cannot exceed the line total`);
    }
    if (!canOverride && discountAmount > lineSubtotal * UNAUTHORIZED_DISCOUNT_LIMIT) {
      throw new ApiError(403, `Discount for "${product.name}" exceeds your permitted limit — manager approval required`);
    }

    subtotal += lineSubtotal;
    itemDiscountTotal += discountAmount;
    preparedItems.push({
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice,
      discountAmount,
      lineTotal: lineSubtotal - discountAmount,
    });
  }

  const cartDiscountAmount = Number(data.cartDiscountAmount) || 0;
  if (cartDiscountAmount > subtotal) throw new ApiError(422, 'Cart discount cannot exceed the subtotal');
  if (!canOverride && cartDiscountAmount > subtotal * UNAUTHORIZED_DISCOUNT_LIMIT) {
    throw new ApiError(403, 'Cart discount exceeds your permitted limit — manager approval required');
  }

  const taxAmount = 0;
  const totalAmount = subtotal - itemDiscountTotal - cartDiscountAmount + taxAmount;
  if (totalAmount < 0) throw new ApiError(422, 'Discounts cannot exceed the sale total');

  if (!data.payments?.length) throw new ApiError(400, 'Add at least one payment');
  const totalPaid = data.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  if (totalPaid < totalAmount) throw new ApiError(422, 'Total paid must cover the sale total');

  const saleNumber = await generateCode('SALE', 'SAL', { tenantId: user.tenantId, padLength: 6 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const saleId = await saleRepository.createSale(
      {
        tenantId: user.tenantId,
        saleNumber,
        idempotencyKey: data.idempotencyKey,
        branchId,
        customerId: data.customerId || null,
        cashierId: actorId,
        subtotal,
        discountAmount: itemDiscountTotal + cartDiscountAmount,
        taxAmount,
        totalAmount,
        notes: data.notes,
      },
      connection,
    );

    const lowStockCrossings = [];

    for (const item of preparedItems) {
      await saleRepository.createItem(
        {
          saleId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          lineTotal: item.lineTotal,
        },
        connection,
      );

      const movement = await inventoryRepository.recordMovement(
        {
          tenantId: user.tenantId,
          productId: item.productId,
          branchId,
          movementType: 'sale',
          quantityChange: -item.quantity,
          referenceType: 'sale',
          referenceId: saleId,
          userId: actorId,
        },
        connection,
      );

      if (movement.crossedIntoLowStock) {
        lowStockCrossings.push({
          productId: item.productId, productName: item.productName, newStock: movement.newStock, minStock: movement.minStock,
        });
      }
    }

    for (const payment of data.payments) {
      await saleRepository.createPayment(
        { saleId, method: payment.method, amount: payment.amount, referenceNumber: payment.referenceNumber },
        connection,
      );
    }

    await connection.commit();

    await activityLogRepository.create({
      tenantId: user.tenantId,
      userId: actorId,
      branchId,
      description: `Sale "${saleNumber}" completed (${preparedItems.length} item${preparedItems.length === 1 ? '' : 's'}, ${formatCurrency(totalAmount)})`,
      referenceType: 'sale',
      referenceId: saleId,
    });

    await notificationRepository.notifyBranchManagement(user.tenantId, branchId, {
      type: 'success',
      category: 'sale_completed',
      title: 'Sale completed',
      message: `Sale "${saleNumber}" completed at "${branch.name}" (${formatCurrency(totalAmount)})`,
      referenceType: 'sale',
      referenceId: saleId,
    });

    // Fired only after the sale itself is committed, using the exact
    // previous/new stock recordMovement() observed inside that same
    // transaction — never notifies about a stock dip that ended up rolled back.
    for (const crossing of lowStockCrossings) {
      await notificationRepository.notifyBranchManagement(user.tenantId, branchId, {
        type: 'warning',
        category: 'low_stock',
        title: 'Low stock alert',
        message: `"${crossing.productName}" at "${branch.name}" has dropped to ${crossing.newStock} units (threshold: ${crossing.minStock})`,
        referenceType: 'product',
        referenceId: crossing.productId,
      });
    }

    return withProfitVisibility(await saleRepository.findById(saleId, user.tenantId), user);
  } catch (err) {
    await connection.rollback();
    // Two requests carrying the same idempotencyKey can both pass the
    // pre-check above if they arrive close enough together (neither has
    // committed yet when the other checks) — the UNIQUE constraint on
    // idempotency_key is what actually decides the race, and the loser
    // hits it here. Rather than surface that as a checkout failure, return
    // whichever sale the winner just created — from the client's point of
    // view, its checkout still succeeds.
    if (err.code === 'ER_DUP_ENTRY' && data.idempotencyKey && err.sqlMessage?.includes('idempotency_key')) {
      const existingSaleId = await saleRepository.findByIdempotencyKey(data.idempotencyKey, user.tenantId);
      if (existingSaleId) {
        return withProfitVisibility(await saleRepository.findById(existingSaleId, user.tenantId), user);
      }
    }
    throw err;
  } finally {
    connection.release();
  }
}

