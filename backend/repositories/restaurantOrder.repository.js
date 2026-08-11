import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

const DETAIL_SELECT = `
  SELECT o.*, t.table_number, b.name AS branch_name,
         c.first_name AS customer_first_name, c.last_name AS customer_last_name,
         u.first_name AS opened_by_first_name, u.last_name AS opened_by_last_name
  FROM restaurant_orders o
  JOIN branches b ON b.id = o.branch_id
  LEFT JOIN restaurant_tables t ON t.id = o.table_id
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN users u ON u.id = o.opened_by
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE o.id = ? AND o.tenant_id = ? LIMIT 1`, [id, tenantId]);
  if (!rows[0]) return null;
  const [items] = await pool.query(
    `SELECT oi.*, mi.name AS menu_item_name
     FROM restaurant_order_items oi
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = ?`,
    [id],
  );
  return { ...rows[0], items };
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status, branchId, branchIds }) {
  const scope = buildScope({ tenantId, tenantColumn: 'o.tenant_id', branchIds, branchColumn: 'o.branch_id' });
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    conditions.push('(o.order_number LIKE ? OR t.table_number LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (branchId) {
    conditions.push('o.branch_id = ?');
    params.push(branchId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${DETAIL_SELECT} ${whereClause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM restaurant_orders o LEFT JOIN restaurant_tables t ON t.id = o.table_id ${whereClause}`,
    allParams,
  );

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, branchId, tableId, customerId, orderNumber, openedBy }, connection) {
  const [result] = await connection.query(
    `INSERT INTO restaurant_orders (tenant_id, branch_id, table_id, customer_id, order_number, status, total_amount, opened_by)
     VALUES (?, ?, ?, ?, ?, 'open', 0, ?)`,
    [tenantId, branchId, tableId || null, customerId || null, orderNumber, openedBy],
  );
  return result.insertId;
}

export async function createItem({ orderId, menuItemId, quantity, unitPrice, lineTotal }, connection) {
  const [result] = await connection.query(
    'INSERT INTO restaurant_order_items (order_id, menu_item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
    [orderId, menuItemId, quantity, unitPrice, lineTotal],
  );
  return result.insertId;
}

export async function setTotal(id, totalAmount, connection = pool) {
  await connection.query('UPDATE restaurant_orders SET total_amount = ? WHERE id = ?', [totalAmount, id]);
}

// Optimistic-concurrency status transition: only succeeds if the row is
// still in `fromStatus` at the moment of the write. Returns affectedRows so
// the service layer can tell a real transition apart from "someone else
// already moved it" (0 rows) without a separate SELECT ... FOR UPDATE — no
// two concurrent requests can both apply the same transition twice.
export async function transitionStatus(id, tenantId, fromStatuses, toStatus, connection = pool) {
  const [result] = await connection.query(
    `UPDATE restaurant_orders SET status = ? WHERE id = ? AND tenant_id = ? AND status IN (?)`,
    [toStatus, id, tenantId, fromStatuses],
  );
  return result.affectedRows > 0;
}

export async function setPaymentMethod(id, tenantId, paymentMethod, connection = pool) {
  await connection.query('UPDATE restaurant_orders SET payment_method = ? WHERE id = ? AND tenant_id = ?', [paymentMethod, id, tenantId]);
}

// Item-level kitchen workflow. Scoped through a join to restaurant_orders so
// a tenant can never update another tenant's item by guessing an id — there
// is no tenant_id column on restaurant_order_items itself, order_id is the
// only link, so every kitchen write must prove tenant ownership through it.
// Same optimistic-lock shape as transitionStatus() above: the write only
// applies if the item is still in one of `fromStatuses` at that moment, so
// two kitchen staff tapping the same ticket can't both apply the same
// transition twice.
export async function updateItemKitchenStatus(itemId, tenantId, fromStatuses, toStatus) {
  const [rows] = await pool.query(
    `SELECT oi.order_id, oi.kitchen_status FROM restaurant_order_items oi
     JOIN restaurant_orders o ON o.id = oi.order_id
     WHERE oi.id = ? AND o.tenant_id = ? LIMIT 1`,
    [itemId, tenantId],
  );
  if (!rows[0]) return { found: false, moved: false, orderId: null };
  if (!fromStatuses.includes(rows[0].kitchen_status)) return { found: true, moved: false, orderId: rows[0].order_id };

  await pool.query('UPDATE restaurant_order_items SET kitchen_status = ? WHERE id = ?', [toStatus, itemId]);
  return { found: true, moved: true, orderId: rows[0].order_id };
}

// Bulk-stamps every item on the ticket 'served' at once — called only when
// the order header itself moves to 'served' (markServed() in the service),
// since food is delivered to the table as one event, not tracked dish by
// dish the way kitchen preparation is.
export async function markAllItemsServed(orderId, connection = pool) {
  await connection.query(
    "UPDATE restaurant_order_items SET kitchen_status = 'served' WHERE order_id = ?",
    [orderId],
  );
}

export async function getOrderItemStatuses(orderId, tenantId) {
  const [rows] = await pool.query(
    `SELECT oi.kitchen_status FROM restaurant_order_items oi
     JOIN restaurant_orders o ON o.id = oi.order_id
     WHERE oi.order_id = ? AND o.tenant_id = ?`,
    [orderId, tenantId],
  );
  return rows.map((r) => r.kitchen_status);
}

// The Kitchen screen's queue — every item still in flight (not yet served),
// across every order that has actually been sent to the kitchen (an OPEN
// order's items are invisible here until the waiter sends it).
export async function findKitchenQueue(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'o.tenant_id', branchIds, branchColumn: 'o.branch_id' });
  const [rows] = await pool.query(
    `SELECT oi.id, oi.quantity, oi.kitchen_status, oi.created_at,
            mi.name AS menu_item_name,
            o.id AS order_id, o.order_number, o.status AS order_status, o.created_at AS order_created_at,
            t.table_number
     FROM restaurant_order_items oi
     JOIN restaurant_orders o ON o.id = oi.order_id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     LEFT JOIN restaurant_tables t ON t.id = o.table_id
     WHERE oi.kitchen_status != 'served'
       AND o.status IN ('sent_to_kitchen', 'preparing', 'ready')
       ${scope.clause}
     ORDER BY o.created_at ASC`,
    scope.params,
  );
  return rows;
}

export async function getSalesSummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'tenant_id', branchIds, branchColumn: 'branch_id' });
  const [[row]] = await pool.query(
    `SELECT
       COUNT(*) AS todayOrders,
       COALESCE(SUM(total_amount), 0) AS todaySales,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completedOrdersToday
     FROM restaurant_orders
     WHERE DATE(created_at) = CURDATE() ${scope.clause}`,
    scope.params,
  );
  return {
    todayOrders: Number(row.todayOrders),
    todaySales: Number(row.todaySales),
    completedOrdersToday: Number(row.completedOrdersToday),
  };
}

export async function getPendingKitchenCount(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'o.tenant_id', branchIds, branchColumn: 'o.branch_id' });
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS pendingKitchenOrders FROM restaurant_order_items oi
     JOIN restaurant_orders o ON o.id = oi.order_id
     WHERE oi.kitchen_status != 'served' AND o.status IN ('sent_to_kitchen', 'preparing', 'ready') ${scope.clause}`,
    scope.params,
  );
  return { pendingKitchenOrders: Number(row.pendingKitchenOrders) };
}

export async function findRecent(tenantId, branchIds, limit = 5) {
  const scope = buildScope({ tenantId, tenantColumn: 'o.tenant_id', branchIds, branchColumn: 'o.branch_id' });
  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at, t.table_number
     FROM restaurant_orders o LEFT JOIN restaurant_tables t ON t.id = o.table_id
     WHERE 1 = 1 ${scope.clause}
     ORDER BY o.created_at DESC LIMIT ?`,
    [...scope.params, limit],
  );
  return rows;
}
