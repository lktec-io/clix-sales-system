import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

export async function record({ tenantId, medicineId, batchId, branchId, movementType, quantityChange, referenceType, referenceId, userId }, connection) {
  await connection.query(
    `INSERT INTO pharmacy_stock_movements (tenant_id, medicine_id, batch_id, branch_id, movement_type, quantity_change, reference_type, reference_id, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, medicineId, batchId, branchId, movementType, quantityChange, referenceType || null, referenceId || null, userId || null],
  );
}

export async function findByMedicine(medicineId, tenantId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT sm.*, b.batch_number FROM pharmacy_stock_movements sm
     JOIN medicine_batches b ON b.id = sm.batch_id
     WHERE sm.medicine_id = ? AND sm.tenant_id = ? ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`,
    [medicineId, tenantId, limit, offset],
  );
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pharmacy_stock_movements WHERE medicine_id = ? AND tenant_id = ?',
    [medicineId, tenantId],
  );
  return { rows, total };
}

export async function findAll({ tenantId, branchIds, page = 1, limit = 20 }) {
  const scope = buildScope({ tenantId, tenantColumn: 'sm.tenant_id', branchIds, branchColumn: 'sm.branch_id' });
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT sm.*, m.name AS medicine_name, b.batch_number
     FROM pharmacy_stock_movements sm
     JOIN medicines m ON m.id = sm.medicine_id
     JOIN medicine_batches b ON b.id = sm.batch_id
     WHERE 1 = 1 ${scope.clause} ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`,
    [...scope.params, limit, offset],
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM pharmacy_stock_movements sm WHERE 1 = 1 ${scope.clause}`,
    scope.params,
  );
  return { rows, total };
}
