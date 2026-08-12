import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import { generateCode } from '../repositories/sequence.repository.js';
import * as restaurantOrderRepository from '../repositories/restaurantOrder.repository.js';
import * as restaurantTableRepository from '../repositories/restaurantTable.repository.js';
import * as menuItemRepository from '../repositories/menuItem.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { formatCurrency } from '../utils/formatCurrency.js';

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Mirrors sale.service.js/purchase.service.js's identical helper.
async function assertBranchAccess(user, branchId) {
  const branchIds = await getAccessibleBranchIds(user);
  if (branchIds !== null && !branchIds.includes(branchId)) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
}

// One authoritative state machine (see 033_create_restaurant_tables.sql's
// own header comment) — every transition in this file is checked against
// this map before it's allowed to happen; nothing else in the codebase
// decides order status. 'preparing'/'ready' are never reached through this
// map directly — they're derived from item kitchen_status in
// deriveOrderStatusFromItems() below, not requested by a caller.
const ALLOWED_TRANSITIONS = {
  open: ['sent_to_kitchen', 'cancelled'],
  sent_to_kitchen: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: ['paid'],
  paid: ['completed'],
  completed: [],
  cancelled: [],
};

async function assertTransition(orderId, tenantId, toStatus) {
  const order = await restaurantOrderRepository.findById(orderId, tenantId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (!ALLOWED_TRANSITIONS[order.status]?.includes(toStatus)) {
    throw new ApiError(400, `Cannot move order from "${order.status}" to "${toStatus}"`);
  }
  return order;
}

export async function listOrders(query, user) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const branchIds = await getAccessibleBranchIds(user);
  const { rows, total } = await restaurantOrderRepository.findAll({
    tenantId: user.tenantId, page, limit, search: query.search, status: query.status,
    branchId: query.branchId ? Number(query.branchId) : undefined, branchIds,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getOrder(id, tenantId) {
  const order = await restaurantOrderRepository.findById(id, tenantId);
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}

// Opens a new order with its full item list in one shot — there is no
// separate "add item to an already-open order" endpoint (a mis-added item
// is cancelled and re-entered, not edited in place), keeping the write
// surface small on purpose. Prices are always looked up server-side from
// menu_items.selling_price; nothing about the total is ever taken from the
// request body.
export async function createOrder(data, actorId, tenantId, user) {
  if (!data.items?.length) throw new ApiError(400, 'Add at least one menu item to the order');

  const branch = await branchRepository.findById(data.branchId, tenantId);
  if (!branch) throw new ApiError(400, 'Selected branch does not exist');
  await assertBranchAccess(user, data.branchId);

  let table = null;
  if (data.tableId) {
    table = await restaurantTableRepository.findById(data.tableId, tenantId);
    if (!table || !table.is_active) throw new ApiError(400, 'Selected table does not exist');
    if (table.status !== 'available') throw new ApiError(400, `Table "${table.table_number}" is not available`);
  }

  if (data.customerId) {
    const customer = await customerRepository.findById(data.customerId, tenantId);
    if (!customer) throw new ApiError(400, 'Selected customer does not exist');
  }

  const resolvedItems = [];
  for (const item of data.items) {
    if (!(Number(item.quantity) > 0)) throw new ApiError(400, 'Quantity must be greater than zero for every item');
    const menuItem = await menuItemRepository.findById(item.menuItemId, tenantId);
    if (!menuItem || !menuItem.is_available) throw new ApiError(400, `Menu item ${item.menuItemId} is not available`);
    resolvedItems.push({ menuItem, quantity: Number(item.quantity) });
  }

  const orderNumber = await generateCode('RESTAURANT_ORDER', 'ORD', { tenantId, padLength: 6 });
  const totalAmount = round2(resolvedItems.reduce((sum, { menuItem, quantity }) => sum + Number(menuItem.selling_price) * quantity, 0));

  const connection = await pool.getConnection();
  let orderId;
  try {
    await connection.beginTransaction();

    orderId = await restaurantOrderRepository.create({
      tenantId, branchId: data.branchId, tableId: data.tableId, customerId: data.customerId, orderNumber, openedBy: actorId,
    }, connection);

    for (const { menuItem, quantity } of resolvedItems) {
      const unitPrice = Number(menuItem.selling_price);
      const lineTotal = round2(unitPrice * quantity);
      await restaurantOrderRepository.createItem({ orderId, menuItemId: menuItem.id, quantity, unitPrice, lineTotal }, connection);
    }

    await restaurantOrderRepository.setTotal(orderId, totalAmount, connection);

    if (table) {
      await restaurantTableRepository.setStatus(table.id, tenantId, 'occupied', connection);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: data.branchId,
    description: `Order "${orderNumber}" opened (${formatCurrency(totalAmount)})`,
    referenceType: 'restaurant_order', referenceId: orderId,
  });

  return restaurantOrderRepository.findById(orderId, tenantId);
}

export async function sendToKitchen(orderId, actorId, tenantId) {
  await assertTransition(orderId, tenantId, 'sent_to_kitchen');
  const moved = await restaurantOrderRepository.transitionStatus(orderId, tenantId, ['open'], 'sent_to_kitchen');
  if (!moved) throw new ApiError(409, 'Order was already moved by someone else — please refresh');
  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: null,
    description: 'Order sent to kitchen', referenceType: 'restaurant_order', referenceId: orderId,
  });
  return restaurantOrderRepository.findById(orderId, tenantId);
}

// Re-derives the header status from where every item on the ticket
// currently stands — never set directly by a caller. Only ever moves
// forward (sent_to_kitchen -> preparing -> ready); a header that's already
// past 'ready' (served/paid/...) is left alone even if this is called again.
async function deriveOrderStatusFromItems(orderId, tenantId) {
  const order = await restaurantOrderRepository.findById(orderId, tenantId);
  if (!['sent_to_kitchen', 'preparing'].includes(order.status)) return;

  const statuses = await restaurantOrderRepository.getOrderItemStatuses(orderId, tenantId);
  const allReady = statuses.every((s) => s === 'ready' || s === 'served');
  const anyStarted = statuses.some((s) => s !== 'new');

  if (allReady) {
    await restaurantOrderRepository.transitionStatus(orderId, tenantId, ['sent_to_kitchen', 'preparing'], 'ready');
  } else if (anyStarted && order.status === 'sent_to_kitchen') {
    await restaurantOrderRepository.transitionStatus(orderId, tenantId, ['sent_to_kitchen'], 'preparing');
  }
}

// Kitchen staff only ever move an item to 'preparing' or 'ready' — 'served'
// is the front-of-house's own action (markServed below), stamped across
// every item on the ticket at once when food actually leaves the pass, not
// something kitchen staff track item-by-item. Each target status has
// exactly one valid predecessor (forward-only, matching KDS-workflow
// expectations); the repository enforces it atomically.
export async function updateKitchenItemStatus(itemId, kitchenStatus, tenantId) {
  const fromStatuses = { preparing: ['new'], ready: ['preparing'] }[kitchenStatus];
  if (!fromStatuses) throw new ApiError(400, 'Kitchen status can only be set to preparing or ready');

  const result = await restaurantOrderRepository.updateItemKitchenStatus(itemId, tenantId, fromStatuses, kitchenStatus);
  if (!result.found) throw new ApiError(404, 'Order item not found');
  if (!result.moved) throw new ApiError(409, `Item cannot move to "${kitchenStatus}" from its current status`);

  await deriveOrderStatusFromItems(result.orderId, tenantId);
  return restaurantOrderRepository.findById(result.orderId, tenantId);
}

export async function markServed(orderId, actorId, tenantId) {
  await assertTransition(orderId, tenantId, 'served');
  const moved = await restaurantOrderRepository.transitionStatus(orderId, tenantId, ['ready'], 'served');
  if (!moved) throw new ApiError(409, 'Order is not ready to be served yet');
  await restaurantOrderRepository.markAllItemsServed(orderId);
  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: null,
    description: 'Order served', referenceType: 'restaurant_order', referenceId: orderId,
  });
  return restaurantOrderRepository.findById(orderId, tenantId);
}

// One cashier action for what's operationally one real-world event — money
// received and the ticket closed — rather than two separate clicks for
// "paid" then "completed". Both status values still exist in the schema for
// reporting fidelity; they just transition together here. The order's own
// total_amount (computed server-side at creation) is what's charged —
// nothing about the amount is accepted from this request.
export async function recordPaymentAndComplete(orderId, data, actorId, tenantId) {
  const order = await assertTransition(orderId, tenantId, 'paid');
  if (!['cash', 'mobile_money', 'bank_transfer', 'card', 'other'].includes(data.paymentMethod)) {
    throw new ApiError(400, 'Invalid payment method');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const movedToPaid = await restaurantOrderRepository.transitionStatus(orderId, tenantId, ['served'], 'paid', connection);
    if (!movedToPaid) throw new ApiError(409, 'Order is not ready for payment');
    await restaurantOrderRepository.setPaymentMethod(orderId, tenantId, data.paymentMethod, connection);
    await restaurantOrderRepository.transitionStatus(orderId, tenantId, ['paid'], 'completed', connection);
    if (order.table_id) {
      await restaurantTableRepository.setStatus(order.table_id, tenantId, 'available', connection);
    }
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: null,
    description: `Order "${order.order_number}" paid and closed (${formatCurrency(order.total_amount)})`,
    referenceType: 'restaurant_order', referenceId: orderId,
  });

  return restaurantOrderRepository.findById(orderId, tenantId);
}

export async function cancelOrder(orderId, actorId, tenantId) {
  const order = await assertTransition(orderId, tenantId, 'cancelled');
  const moved = await restaurantOrderRepository.transitionStatus(orderId, tenantId, [order.status], 'cancelled');
  if (!moved) throw new ApiError(409, 'Order was already moved by someone else — please refresh');
  if (order.table_id) {
    await restaurantTableRepository.setStatus(order.table_id, tenantId, 'available');
  }
  await activityLogRepository.create({
    tenantId, userId: actorId, branchId: null,
    description: `Order "${order.order_number}" cancelled`, referenceType: 'restaurant_order', referenceId: orderId,
  });
  return restaurantOrderRepository.findById(orderId, tenantId);
}

export async function getKitchenQueue(user) {
  const branchIds = await getAccessibleBranchIds(user);
  const rows = await restaurantOrderRepository.findKitchenQueue(user.tenantId, branchIds);
  return rows;
}

export async function getSalesSummary(user) {
  const branchIds = await getAccessibleBranchIds(user);
  return restaurantOrderRepository.getSalesSummary(user.tenantId, branchIds);
}

export async function getPendingKitchenCount(user) {
  const branchIds = await getAccessibleBranchIds(user);
  return restaurantOrderRepository.getPendingKitchenCount(user.tenantId, branchIds);
}

export async function getRecentOrders(user, limit = 5) {
  const branchIds = await getAccessibleBranchIds(user);
  return restaurantOrderRepository.findRecent(user.tenantId, branchIds, limit);
}
