import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

const DETAIL_SELECT = `
  SELECT r.*, b.name AS branch_name,
         c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone,
         t.first_name AS technician_first_name, t.last_name AS technician_last_name,
         u.first_name AS created_by_first_name, u.last_name AS created_by_last_name
  FROM repairs r
  JOIN branches b ON b.id = r.branch_id
  JOIN customers c ON c.id = r.customer_id
  LEFT JOIN users t ON t.id = r.technician_id
  LEFT JOIN users u ON u.id = r.created_by
`;

// balance is always computed at read time from repair_total/amount_paid —
// never a stored column, so it can never drift out of sync with the
// payments actually recorded (repair_payments is the source of truth for
// amount_paid, kept in sync transactionally by repair.service.js).
function withBalance(row) {
  if (!row) return row;
  return { ...row, balance: Number(row.repair_total) - Number(row.amount_paid) };
}

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE r.id = ? AND r.tenant_id = ? LIMIT 1`, [id, tenantId]);
  if (!rows[0]) return null;

  const [parts] = await pool.query(
    `SELECT rp.*, p.name AS product_name, p.code AS product_code
     FROM repair_parts rp JOIN products p ON p.id = rp.product_id
     WHERE rp.repair_id = ?`,
    [id],
  );
  const [payments] = await pool.query(
    `SELECT rp.*, u.first_name AS received_by_first_name, u.last_name AS received_by_last_name
     FROM repair_payments rp JOIN users u ON u.id = rp.received_by
     WHERE rp.repair_id = ? ORDER BY rp.created_at ASC`,
    [id],
  );
  const [history] = await pool.query(
    `SELECT h.*, u.first_name AS changed_by_first_name, u.last_name AS changed_by_last_name
     FROM repair_status_history h JOIN users u ON u.id = h.changed_by
     WHERE h.repair_id = ? ORDER BY h.created_at ASC`,
    [id],
  );

  return { ...withBalance(rows[0]), parts, payments, history };
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status, deviceType, branchId, dateFrom, dateTo, branchIds }) {
  const scope = buildScope({ tenantId, tenantColumn: 'r.tenant_id', branchIds, branchColumn: 'r.branch_id' });
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    conditions.push('(r.repair_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR r.imei_1 LIKE ? OR r.serial_number LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }
  if (deviceType) {
    conditions.push('r.device_type = ?');
    params.push(deviceType);
  }
  if (branchId) {
    conditions.push('r.branch_id = ?');
    params.push(branchId);
  }
  if (dateFrom) {
    conditions.push('r.received_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('r.received_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(dateTo);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${DETAIL_SELECT} ${whereClause} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM repairs r JOIN customers c ON c.id = r.customer_id ${whereClause}`,
    allParams,
  );

  return { rows: rows.map(withBalance), total: countRows[0].total };
}

export async function create(data, connection) {
  const [result] = await connection.query(
    `INSERT INTO repairs (
       tenant_id, branch_id, repair_number, customer_id, device_type, brand, model,
       serial_number, imei_1, imei_2, device_color, reported_problem, estimated_cost, device_condition,
       accessories_received, expected_completion_at, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tenantId, data.branchId, data.repairNumber, data.customerId, data.deviceType, data.brand, data.model,
      data.serialNumber || null, data.imei1 || null, data.imei2 || null, data.deviceColor || null,
      data.reportedProblem, data.estimatedCost ?? null, JSON.stringify(data.deviceCondition || {}), JSON.stringify(data.accessoriesReceived || {}),
      data.expectedCompletionAt || null, data.createdBy,
    ],
  );
  return result.insertId;
}

export async function update(id, tenantId, fields, connection = pool) {
  const columns = [];
  const params = [];
  const COLUMN_MAP = {
    diagnosis: 'diagnosis', repairNotes: 'repair_notes', technicianId: 'technician_id',
    laborCharge: 'labor_charge', expectedCompletionAt: 'expected_completion_at',
  };
  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (fields[key] !== undefined) {
      columns.push(`${column} = ?`);
      params.push(fields[key]);
    }
  }
  if (columns.length === 0) return;
  params.push(id, tenantId);
  await connection.query(`UPDATE repairs SET ${columns.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
}

// Optimistic-concurrency status transition — same shape as
// restaurantOrder.repository.js#transitionStatus. Records the change in
// repair_status_history in the same call so the audit trail can never
// exist without a matching status change actually having happened.
export async function transitionStatus(id, tenantId, fromStatuses, toStatus, changedBy, notes, connection = pool) {
  const [result] = await connection.query(
    'UPDATE repairs SET status = ? WHERE id = ? AND tenant_id = ? AND status IN (?)',
    [toStatus, id, tenantId, fromStatuses],
  );
  if (result.affectedRows === 0) return false;

  const [[current]] = await connection.query('SELECT status FROM repairs WHERE id = ?', [id]);
  await connection.query(
    'INSERT INTO repair_status_history (repair_id, from_status, to_status, notes, changed_by) VALUES (?, ?, ?, ?, ?)',
    [id, fromStatuses.length === 1 ? fromStatuses[0] : null, current.status, notes || null, changedBy],
  );
  return true;
}

export async function createPart({ repairId, productId, branchId, quantity, unitCost, unitPrice, lineTotal }, connection) {
  const [result] = await connection.query(
    'INSERT INTO repair_parts (repair_id, product_id, branch_id, quantity, unit_cost, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [repairId, productId, branchId, quantity, unitCost, unitPrice, lineTotal],
  );
  return result.insertId;
}

export async function recalculateTotals(id, connection = pool) {
  await connection.query(
    `UPDATE repairs SET
       parts_total = COALESCE((SELECT SUM(line_total) FROM repair_parts WHERE repair_id = ?), 0),
       repair_total = COALESCE((SELECT SUM(line_total) FROM repair_parts WHERE repair_id = ?), 0) + labor_charge
     WHERE id = ?`,
    [id, id, id],
  );
}

export async function addPaidAmount(id, amount, connection) {
  await connection.query('UPDATE repairs SET amount_paid = amount_paid + ? WHERE id = ?', [amount, id]);
}

export async function createPayment({ repairId, amount, paymentMethod, receivedBy }, connection) {
  const [result] = await connection.query(
    'INSERT INTO repair_payments (repair_id, amount, payment_method, received_by) VALUES (?, ?, ?, ?)',
    [repairId, amount, paymentMethod, receivedBy],
  );
  return result.insertId;
}

export async function getDashboardSummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'tenant_id', branchIds, branchColumn: 'branch_id' });
  const [[row]] = await pool.query(
    `SELECT
       COUNT(CASE WHEN DATE(received_at) = CURDATE() THEN 1 END) AS todayRepairs,
       COUNT(CASE WHEN status = 'diagnosis' THEN 1 END) AS pendingDiagnosis,
       COUNT(CASE WHEN status = 'waiting_approval' THEN 1 END) AS waitingApproval,
       COUNT(CASE WHEN status = 'in_repair' THEN 1 END) AS inRepairCount,
       COUNT(CASE WHEN status = 'ready_for_collection' THEN 1 END) AS readyForCollection,
       COUNT(CASE WHEN status = 'completed' AND DATE(completed_at) = CURDATE() THEN 1 END) AS completedRepairsToday,
       COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','rejected','unrepairable') THEN repair_total - amount_paid ELSE 0 END), 0) AS outstandingRepairPayments
     FROM repairs WHERE 1 = 1 ${scope.clause}`,
    scope.params,
  );
  return {
    todayRepairs: Number(row.todayRepairs),
    pendingDiagnosis: Number(row.pendingDiagnosis),
    waitingApproval: Number(row.waitingApproval),
    inRepairCount: Number(row.inRepairCount),
    readyForCollection: Number(row.readyForCollection),
    completedRepairsToday: Number(row.completedRepairsToday),
    outstandingRepairPayments: Number(row.outstandingRepairPayments),
  };
}

export async function findRecent(tenantId, branchIds, limit = 5) {
  const scope = buildScope({ tenantId, tenantColumn: 'r.tenant_id', branchIds, branchColumn: 'r.branch_id' });
  const [rows] = await pool.query(
    `SELECT r.id, r.repair_number, r.brand, r.model, r.status, r.repair_total, r.received_at,
            c.first_name AS customer_first_name, c.last_name AS customer_last_name
     FROM repairs r JOIN customers c ON c.id = r.customer_id
     WHERE 1 = 1 ${scope.clause}
     ORDER BY r.received_at DESC LIMIT ?`,
    [...scope.params, limit],
  );
  return rows;
}

// Customer detail page's "Repair History" tab.
export async function findByCustomer(customerId, tenantId) {
  const [rows] = await pool.query(
    `SELECT id, repair_number, device_type, brand, model, reported_problem, status, repair_total, received_at
     FROM repairs WHERE customer_id = ? AND tenant_id = ? ORDER BY received_at DESC`,
    [customerId, tenantId],
  );
  return rows;
}
