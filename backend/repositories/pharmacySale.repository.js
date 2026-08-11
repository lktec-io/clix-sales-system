import { pool } from '../config/db.js';
import { buildScope } from '../utils/tenantScope.js';

const DETAIL_SELECT = `
  SELECT s.*, b.name AS branch_name,
         c.first_name AS customer_first_name, c.last_name AS customer_last_name,
         u.first_name AS sold_by_first_name, u.last_name AS sold_by_last_name
  FROM pharmacy_sales s
  JOIN branches b ON b.id = s.branch_id
  LEFT JOIN customers c ON c.id = s.customer_id
  LEFT JOIN users u ON u.id = s.sold_by
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${DETAIL_SELECT} WHERE s.id = ? AND s.tenant_id = ? LIMIT 1`, [id, tenantId]);
  if (!rows[0]) return null;
  const [items] = await pool.query(
    `SELECT si.*, m.name AS medicine_name, mb.batch_number, mb.expiry_date
     FROM pharmacy_sale_items si
     JOIN medicines m ON m.id = si.medicine_id
     JOIN medicine_batches mb ON mb.id = si.batch_id
     WHERE si.sale_id = ?`,
    [id],
  );
  return { ...rows[0], items };
}

export async function findAll({ tenantId, page = 1, limit = 20, search, branchId, branchIds }) {
  const scope = buildScope({ tenantId, tenantColumn: 's.tenant_id', branchIds, branchColumn: 's.branch_id' });
  const conditions = ['1 = 1'];
  const params = [];

  if (search) {
    conditions.push('(s.sale_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (branchId) {
    conditions.push('s.branch_id = ?');
    params.push(branchId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${DETAIL_SELECT} ${whereClause} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...allParams, limit, offset],
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM pharmacy_sales s LEFT JOIN customers c ON c.id = s.customer_id ${whereClause}`,
    allParams,
  );

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, branchId, customerId, saleNumber, paymentMethod, totalAmount, soldBy }, connection) {
  const [result] = await connection.query(
    `INSERT INTO pharmacy_sales (tenant_id, branch_id, customer_id, sale_number, payment_method, total_amount, sold_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, branchId, customerId || null, saleNumber, paymentMethod || 'cash', totalAmount, soldBy],
  );
  return result.insertId;
}

export async function createItem({ saleId, medicineId, batchId, quantity, unitPrice, lineTotal }, connection) {
  await connection.query(
    'INSERT INTO pharmacy_sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
    [saleId, medicineId, batchId, quantity, unitPrice, lineTotal],
  );
}

// Named todaySalesCount/todayRevenue, not todaySales — the retail
// dashboard's own EMPTY_KPIS already uses "todaySales" for a currency
// amount; these two KPI sets are merged into one flat object in
// dashboard.service.js#getKpis(), so a same-named-but-different-meaning
// key here would silently overwrite retail's figure for any tenant (never
// happens today since Pharmacy/Retail are different templates with
// different resolved widgets, but the merge itself doesn't know that).
export async function getSalesSummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'tenant_id', branchIds, branchColumn: 'branch_id' });
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS todaySalesCount, COALESCE(SUM(total_amount), 0) AS todayRevenue
     FROM pharmacy_sales WHERE status = 'completed' AND DATE(created_at) = CURDATE() ${scope.clause}`,
    scope.params,
  );
  return { todaySalesCount: Number(row.todaySalesCount), todayRevenue: Number(row.todayRevenue) };
}

export async function findRecent(tenantId, branchIds, limit = 5) {
  const scope = buildScope({ tenantId, tenantColumn: 's.tenant_id', branchIds, branchColumn: 's.branch_id' });
  const [rows] = await pool.query(
    `SELECT s.id, s.sale_number, s.total_amount, s.created_at,
            c.first_name AS customer_first_name, c.last_name AS customer_last_name
     FROM pharmacy_sales s LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.status = 'completed' ${scope.clause}
     ORDER BY s.created_at DESC LIMIT ?`,
    [...scope.params, limit],
  );
  return rows;
}
