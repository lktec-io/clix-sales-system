import { pool } from '../config/db.js';

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    `SELECT g.*, c.first_name AS leader_first_name, c.last_name AS leader_last_name
     FROM loan_groups g LEFT JOIN customers c ON c.id = g.leader_customer_id
     WHERE g.id = ? AND g.tenant_id = ? LIMIT 1`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, status }) {
  const conditions = ['g.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('g.name LIKE ?');
    params.push(`%${search}%`);
  }
  if (status) {
    conditions.push('g.status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT g.*, c.first_name AS leader_first_name, c.last_name AS leader_last_name,
            (SELECT COUNT(*) FROM loan_group_members m WHERE m.loan_group_id = g.id) AS member_count
     FROM loan_groups g LEFT JOIN customers c ON c.id = g.leader_customer_id
     ${whereClause} ORDER BY g.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM loan_groups g ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function create({ tenantId, name, leaderCustomerId, userId }) {
  const [result] = await pool.query(
    'INSERT INTO loan_groups (tenant_id, name, leader_customer_id, created_by) VALUES (?, ?, ?, ?)',
    [tenantId, name, leaderCustomerId || null, userId],
  );
  return findById(result.insertId, tenantId);
}

export async function update(id, tenantId, { name, leaderCustomerId, status }) {
  await pool.query(
    'UPDATE loan_groups SET name = ?, leader_customer_id = ?, status = ? WHERE id = ? AND tenant_id = ?',
    [name, leaderCustomerId || null, status || 'active', id, tenantId],
  );
  return findById(id, tenantId);
}

export async function findMembers(groupId) {
  const [rows] = await pool.query(
    `SELECT m.id, m.customer_id, m.joined_at, c.first_name, c.last_name, c.phone, c.customer_code
     FROM loan_group_members m JOIN customers c ON c.id = m.customer_id
     WHERE m.loan_group_id = ? ORDER BY m.joined_at ASC`,
    [groupId],
  );
  return rows;
}

export async function addMember(groupId, customerId) {
  await pool.query(
    'INSERT IGNORE INTO loan_group_members (loan_group_id, customer_id) VALUES (?, ?)',
    [groupId, customerId],
  );
}

export async function removeMember(groupId, customerId) {
  await pool.query('DELETE FROM loan_group_members WHERE loan_group_id = ? AND customer_id = ?', [groupId, customerId]);
}
