import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    'SELECT t.*, b.name AS branch_name FROM restaurant_tables t JOIN branches b ON b.id = t.branch_id WHERE t.id = ? AND t.tenant_id = ? LIMIT 1',
    [id, tenantId],
  );
  return rows[0] || null;
}

// The order-builder's table picker — only active, currently available
// tables (occupied/reserved tables would just fail the "open a new order
// here" flow, so they're excluded rather than shown-then-rejected).
export async function findAvailable(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 't.tenant_id', branchIds, branchColumn: 't.branch_id' });
  const [rows] = await pool.query(
    `SELECT t.* FROM restaurant_tables t
     WHERE t.is_active = TRUE AND t.status = 'available' ${scope.clause}
     ORDER BY t.table_number`,
    scope.params,
  );
  return rows;
}

export async function findAll({ tenantId, branchIds, branchId, status }) {
  const scope = buildScope({ tenantId, tenantColumn: 't.tenant_id', branchIds, branchColumn: 't.branch_id' });
  const conditions = ['t.is_active = TRUE'];
  const params = [];

  if (branchId) {
    conditions.push('t.branch_id = ?');
    params.push(branchId);
  }
  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }

  const [rows] = await pool.query(
    `SELECT t.*, b.name AS branch_name FROM restaurant_tables t JOIN branches b ON b.id = t.branch_id
     WHERE ${conditions.join(' AND ')} ${scope.clause} ORDER BY t.table_number`,
    [...params, ...scope.params],
  );
  return rows;
}

export async function create({ tenantId, branchId, tableNumber, capacity }) {
  const [result] = await pool.query(
    'INSERT INTO restaurant_tables (tenant_id, branch_id, table_number, capacity) VALUES (?, ?, ?, ?)',
    [tenantId, branchId, tableNumber, capacity || 1],
  );
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { tableNumber, capacity }) {
  await pool.query(
    'UPDATE restaurant_tables SET table_number = ?, capacity = ? WHERE id = ? AND tenant_id = ?',
    [tableNumber, capacity || 1, id, tenantId],
  );
  return findById(id, tenantId);
}

export async function setStatus(id, tenantId, status, connection = pool) {
  await connection.query('UPDATE restaurant_tables SET status = ? WHERE id = ? AND tenant_id = ?', [status, id, tenantId]);
}

export async function setActive(id, tenantId, isActive) {
  await pool.query('UPDATE restaurant_tables SET is_active = ? WHERE id = ? AND tenant_id = ?', [isActive, id, tenantId]);
}

export async function getOccupancySummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'tenant_id', branchIds, branchColumn: 'branch_id' });
  const [[row]] = await pool.query(
    `SELECT
       COUNT(CASE WHEN status = 'occupied' THEN 1 END) AS occupiedTables,
       COUNT(CASE WHEN status = 'available' THEN 1 END) AS availableTables
     FROM restaurant_tables WHERE is_active = TRUE ${scope.clause}`,
    scope.params,
  );
  return { occupiedTables: Number(row.occupiedTables), availableTables: Number(row.availableTables) };
}
