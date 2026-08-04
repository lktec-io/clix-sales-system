import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { buildScope } from '../utils/tenantScope.js';

// The single source of truth for stock mutation — every future phase that
// changes stock (Purchases, POS, Transfers, Returns, manual Adjustments)
// calls this instead of touching the `inventory` table directly. Accepts an
// optional external connection so it can participate in a caller's larger
// transaction (e.g. POS checkout: sale + payment + inventory in one unit);
// when called standalone it manages its own transaction. tenantId is
// required — every row this writes (inventory, inventory_movements) carries
// its own tenant_id column, and product_id/branch_id alone are no longer
// enough to identify a unique inventory row once a second tenant exists.
export async function recordMovement(data, externalConnection = null) {
  const connection = externalConnection || (await pool.getConnection());
  const managesOwnTransaction = !externalConnection;

  try {
    if (managesOwnTransaction) await connection.beginTransaction();

    const selectForUpdate = `
      SELECT i.*, COALESCE(i.min_stock, p.min_stock) AS effective_min_stock
      FROM inventory i JOIN products p ON p.id = i.product_id
      WHERE i.product_id = ? AND i.branch_id = ? AND i.tenant_id = ? FOR UPDATE
    `;
    let [rows] = await connection.query(selectForUpdate, [data.productId, data.branchId, data.tenantId]);

    if (!rows[0]) {
      await connection.query('INSERT INTO inventory (tenant_id, product_id, branch_id, quantity) VALUES (?, ?, ?, 0)', [
        data.tenantId,
        data.productId,
        data.branchId,
      ]);
      [rows] = await connection.query(selectForUpdate, [data.productId, data.branchId, data.tenantId]);
    }

    const inventoryRow = rows[0];
    const previousStock = inventoryRow.quantity;
    const newStock = previousStock + data.quantityChange;
    const minStock = Number(inventoryRow.effective_min_stock) || 0;

    if (newStock < 0) {
      throw new ApiError(422, 'This movement would result in negative stock, which is not allowed');
    }

    await connection.query('UPDATE inventory SET quantity = ? WHERE id = ?', [newStock, inventoryRow.id]);

    const [movementResult] = await connection.query(
      `INSERT INTO inventory_movements
         (tenant_id, product_id, branch_id, movement_type, quantity_change, previous_stock, new_stock, reference_type, reference_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.tenantId, data.productId, data.branchId, data.movementType, data.quantityChange,
        previousStock, newStock, data.referenceType || null, data.referenceId || null, data.userId,
      ],
    );

    if (managesOwnTransaction) await connection.commit();
    // crossedIntoLowStock: true only on the movement that pushes stock from
    // above the threshold to at-or-below it — callers use this to fire a
    // low-stock notification exactly once per dip, not on every subsequent
    // sale of an already-low product.
    return {
      movementId: movementResult.insertId,
      previousStock,
      newStock,
      minStock,
      crossedIntoLowStock: previousStock > minStock && newStock <= minStock,
    };
  } catch (err) {
    if (managesOwnTransaction) await connection.rollback();
    throw err;
  } finally {
    if (managesOwnTransaction) connection.release();
  }
}

// Used by Transfers to fail fast on "cannot transfer more than available
// stock" before opening a transaction. recordMovement()'s own negative-stock
// guard remains the authoritative check at the moment stock actually moves.
export async function getAvailableQuantity(productId, branchId, tenantId) {
  const [rows] = await pool.query(
    'SELECT quantity, reserved_quantity FROM inventory WHERE product_id = ? AND branch_id = ? AND tenant_id = ? LIMIT 1',
    [productId, branchId, tenantId],
  );
  if (!rows[0]) return 0;
  return rows[0].quantity - rows[0].reserved_quantity;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, branchId, lowStock, outOfStock, branchIds }) {
  const conditions = ['p.deleted_at IS NULL'];
  const params = [];

  if (search) {
    conditions.push('(p.name LIKE ? OR p.code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (branchId) {
    conditions.push('i.branch_id = ?');
    params.push(branchId);
  }
  if (outOfStock) {
    conditions.push('i.quantity = 0');
  } else if (lowStock) {
    conditions.push('i.quantity > 0 AND i.quantity <= COALESCE(i.min_stock, p.min_stock)');
  }

  const scope = buildScope({ tenantId, tenantColumn: 'i.tenant_id', branchIds, branchColumn: 'i.branch_id' });
  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const offset = (page - 1) * limit;
  const allParams = [...params, ...scope.params];

  const [rows] = await pool.query(
    `SELECT i.id, i.product_id, i.branch_id, i.quantity, i.reserved_quantity,
            (i.quantity - i.reserved_quantity) AS available_quantity,
            COALESCE(i.min_stock, p.min_stock) AS min_stock, i.updated_at,
            p.name AS product_name, p.code AS product_code,
            (i.quantity * p.buying_price) AS stock_value,
            b.name AS branch_name
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     JOIN branches b ON b.id = i.branch_id
     ${whereClause}
     ORDER BY i.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM inventory i JOIN products p ON p.id = i.product_id ${whereClause}`,
    allParams,
  );

  return { rows, total: countRows[0].total };
}

export async function getSummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'i.tenant_id', branchIds, branchColumn: 'i.branch_id' });
  const [[row]] = await pool.query(
    `SELECT
       COUNT(*) AS totalProducts,
       COALESCE(SUM(i.quantity * p.buying_price), 0) AS totalValue,
       SUM(CASE WHEN i.quantity = 0 THEN 1 ELSE 0 END) AS outOfStock,
       SUM(CASE WHEN i.quantity > 0 AND i.quantity <= COALESCE(i.min_stock, p.min_stock) THEN 1 ELSE 0 END) AS lowStock
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     WHERE p.deleted_at IS NULL ${scope.clause}`,
    scope.params,
  );
  return {
    totalProducts: Number(row.totalProducts) || 0,
    totalValue: Number(row.totalValue) || 0,
    outOfStock: Number(row.outOfStock) || 0,
    lowStock: Number(row.lowStock) || 0,
  };
}

export async function findMovements({ tenantId, page = 1, limit = 20, productId, branchId, movementType, branchIds }) {
  const conditions = ['1 = 1'];
  const params = [];

  if (productId) {
    conditions.push('m.product_id = ?');
    params.push(productId);
  }
  if (branchId) {
    conditions.push('m.branch_id = ?');
    params.push(branchId);
  }
  if (movementType) {
    conditions.push('m.movement_type = ?');
    params.push(movementType);
  }

  const scope = buildScope({ tenantId, tenantColumn: 'm.tenant_id', branchIds, branchColumn: 'm.branch_id' });
  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const offset = (page - 1) * limit;
  const allParams = [...params, ...scope.params];

  const [rows] = await pool.query(
    `SELECT m.*, p.name AS product_name, p.code AS product_code, b.name AS branch_name,
            u.first_name AS user_first_name, u.last_name AS user_last_name
     FROM inventory_movements m
     JOIN products p ON p.id = m.product_id
     JOIN branches b ON b.id = m.branch_id
     JOIN users u ON u.id = m.user_id
     ${whereClause}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM inventory_movements m ${whereClause}`, allParams);

  return { rows, total: countRows[0].total };
}

export async function createAdjustmentRecord({ tenantId, productId, branchId, movementId, reason, description, userId }) {
  const [result] = await pool.query(
    `INSERT INTO inventory_adjustments (tenant_id, product_id, branch_id, movement_id, reason, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, productId, branchId, movementId, reason, description || null, userId],
  );
  return result.insertId;
}
