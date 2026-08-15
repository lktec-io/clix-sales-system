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

export async function findAll({ tenantId, page = 1, limit = 20, search, branchId, dateFrom, dateTo, branchIds }) {
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
  // s.created_at is a DATETIME — compared by DATE() so a "Today"/"This
  // Week" filter (plain YYYY-MM-DD boundaries, same as expense.repository.js's
  // dateFrom/dateTo convention) matches on calendar date, not clock time.
  if (dateFrom) {
    conditions.push('DATE(s.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(s.created_at) <= ?');
    params.push(dateTo);
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
//
// medicinesSoldCount/todayProfit are new (KPI dashboard rebuild). todayProfit
// intentionally REUSES retail's own key name (dashboard.repository.js#getKpis)
// rather than inventing a Pharmacy-specific one — it's the exact same concept
// (today's completed-sale revenue minus cost of goods sold), just computed
// against pharmacy_sale_items/medicine_batches instead of sale_items/products.
// Same safe-to-share reasoning as todayOrders/todaySales between Retail and
// Restaurant: Pharmacy and Retail are mutually exclusive templates, so the
// flat-object merge in dashboard.service.js#getKpis() never has both sides
// populated for the same tenant, and no template's dashboard_widgets list
// currently gates "todayProfit" except Pharmacy's (see migration 043).
export async function getSalesSummary(tenantId, branchIds) {
  const scope = buildScope({ tenantId, tenantColumn: 'tenant_id', branchIds, branchColumn: 'branch_id' });
  const [[salesRow]] = await pool.query(
    `SELECT COUNT(*) AS todaySalesCount, COALESCE(SUM(total_amount), 0) AS todayRevenue
     FROM pharmacy_sales WHERE status = 'completed' AND DATE(created_at) = CURDATE() ${scope.clause}`,
    scope.params,
  );

  // medicinesSoldCount/todayProfit need each sale item joined to the exact
  // batch it was dispensed from (batch_id — the FEFO allocation recorded by
  // sellMedicines() in pharmacySale.service.js) so cost is the real
  // buying_price of the batch actually sold, not an estimate. Same
  // tenant/branch/today scope as above, just aliased onto the joined
  // pharmacy_sales row.
  const itemScope = buildScope({ tenantId, tenantColumn: 'ps.tenant_id', branchIds, branchColumn: 'ps.branch_id' });
  const [[itemsRow]] = await pool.query(
    `SELECT COALESCE(SUM(psi.quantity), 0) AS medicinesSoldCount,
            COALESCE(SUM(psi.line_total), 0) - COALESCE(SUM(psi.quantity * mb.buying_price), 0) AS todayProfit
     FROM pharmacy_sale_items psi
     JOIN pharmacy_sales ps ON ps.id = psi.sale_id
     JOIN medicine_batches mb ON mb.id = psi.batch_id
     WHERE ps.status = 'completed' AND DATE(ps.created_at) = CURDATE() ${itemScope.clause}`,
    itemScope.params,
  );

  return {
    todaySalesCount: Number(salesRow.todaySalesCount),
    todayRevenue: Number(salesRow.todayRevenue),
    medicinesSoldCount: Number(itemsRow.medicinesSoldCount),
    todayProfit: Number(itemsRow.todayProfit),
  };
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
