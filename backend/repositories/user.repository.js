import { pool } from '../config/db.js';

const BASE_SELECT = `
  SELECT u.id, u.tenant_id, u.first_name, u.last_name, u.gender, u.phone, u.email, u.username,
         u.password_hash, u.role_id, u.branch_id, u.avatar_path, u.preferred_language, u.status,
         u.failed_login_attempts, u.locked_until, u.last_login_at,
         u.created_at, u.updated_at, u.deleted_at,
         r.name AS role_name,
         b.name AS branch_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN branches b ON b.id = u.branch_id
`;

// Login/refresh is the one lookup that must NOT be tenant-scoped — the
// tenant isn't known yet at that point (identifying which tenant a login
// belongs to is the whole point of this query). Every other repository
// function below that touches more than one row (findAll) or performs a
// uniqueness check (findConflict) IS tenant-scoped, since users.email/
// username/phone became composite-unique per (tenant_id, x) in
// 019_scope_unique_keys_to_tenant.sql — two different tenants may now
// legitimately share the same email.

export async function findByEmailOrUsername(identifier) {
  const [rows] = await pool.query(
    `${BASE_SELECT} WHERE (u.email = ? OR u.username = ?) AND u.deleted_at IS NULL LIMIT 1`,
    [identifier, identifier],
  );
  return rows[0] || null;
}

export async function findById(id) {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function create({ tenantId, firstName, lastName, gender, phone, email, username, passwordHash, roleId, branchId, status }) {
  const [result] = await pool.query(
    `INSERT INTO users (tenant_id, first_name, last_name, gender, phone, email, username, password_hash, role_id, branch_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, firstName, lastName, gender || null, phone, email, username, passwordHash, roleId, branchId || null, status || 'active'],
  );
  return findById(result.insertId);
}

export async function incrementFailedAttemptsAndMaybeLock(id, maxAttempts, lockMinutes) {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = IF(failed_login_attempts + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until)
     WHERE id = ?`,
    [maxAttempts, lockMinutes, id],
  );
}

export async function resetFailedAttempts(id) {
  await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [id]);
}

export async function updateLastLogin(id) {
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
}

export async function updatePasswordHash(id, passwordHash) {
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

// tenantId-scoped since email/username/phone are only unique *within* a
// tenant (019_scope_unique_keys_to_tenant.sql) — a different tenant already
// using the same email is not a conflict.
export async function findConflict(tenantId, { email, username, phone }, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT id, email, username, phone FROM users
     WHERE tenant_id = ? AND deleted_at IS NULL AND (email = ? OR username = ? OR phone = ?) ${excludeId ? 'AND id <> ?' : ''}
     LIMIT 1`,
    excludeId ? [tenantId, email, username, phone, excludeId] : [tenantId, email, username, phone],
  );
  return rows[0] || null;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, roleId, branchId, status }) {
  const conditions = ['u.tenant_id = ?', 'u.deleted_at IS NULL'];
  const params = [tenantId];

  if (search) {
    conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR u.phone LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }
  if (roleId) {
    conditions.push('u.role_id = ?');
    params.push(roleId);
  }
  if (branchId) {
    conditions.push('u.branch_id = ?');
    params.push(branchId);
  }
  if (status) {
    conditions.push('u.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${BASE_SELECT} ${whereClause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
    params,
  );

  return { rows, total: countRows[0].total };
}

// tenantId guards the WHERE clause as defense-in-depth (id alone is already
// a unique PK regardless of tenant) — mirrors the pattern used everywhere
// else a tenant-owned row is mutated by id.
export async function update(id, tenantId, { firstName, lastName, gender, phone, email, username, roleId, branchId, userId }) {
  await pool.query(
    `UPDATE users SET first_name = ?, last_name = ?, gender = ?, phone = ?, email = ?, username = ?,
       role_id = ?, branch_id = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`,
    [firstName, lastName, gender || null, phone, email, username, roleId, branchId || null, userId, id, tenantId],
  );
  return findById(id);
}

export async function updateStatus(id, status, userId) {
  await pool.query('UPDATE users SET status = ?, updated_by = ? WHERE id = ?', [status, userId, id]);
  return findById(id);
}

// Self-service profile edit — deliberately narrower than update(): a user
// changes their own name/phone, never their own email/username/role/branch
// (those stay administrative, gated by users.edit).
export async function updateOwnProfile(id, { firstName, lastName, gender, phone }) {
  await pool.query(
    'UPDATE users SET first_name = ?, last_name = ?, gender = ?, phone = ? WHERE id = ?',
    [firstName, lastName, gender || null, phone, id],
  );
  return findById(id);
}

export async function updateAvatarPath(id, avatarPath) {
  await pool.query('UPDATE users SET avatar_path = ? WHERE id = ?', [avatarPath, id]);
  return findById(id);
}

// Self-service language switch — deliberately its own single-column update
// (not folded into updateOwnProfile) so flipping the language toggle never
// has to resend/revalidate the rest of the profile form.
export async function updatePreferredLanguage(id, preferredLanguage) {
  await pool.query('UPDATE users SET preferred_language = ? WHERE id = ?', [preferredLanguage, id]);
  return findById(id);
}

// Mangles email/username/phone at delete time, not just marks deleted_at —
// those three columns each carry a plain UNIQUE KEY at the schema level
// (see 002_create_branches_users.sql) with no awareness of deleted_at, so
// a soft-deleted row's original values permanently block recreating an
// account with the same email/username/phone: assertNoConflict() (the
// app-level check) correctly filters deleted_at IS NULL and finds nothing,
// but the raw INSERT then hits the DB's own unique index and fails with
// ER_DUP_ENTRY — surfacing to the client as a 409 on an account that looks,
// from the UI, like it was already deleted. Using the row's own id keeps
// every mangled value both deterministic and permanently unique (ids are
// never reused), and each generated value comfortably fits its column's
// width (email VARCHAR(150), username VARCHAR(50), phone VARCHAR(20)).
export async function softDelete(id, userId) {
  await pool.query(
    `UPDATE users
     SET deleted_at = NOW(), updated_by = ?,
         email = CONCAT('deleted_user_', id, '@deleted.invalid'),
         username = CONCAT('deleted_user_', id),
         phone = CONCAT('deleted', id)
     WHERE id = ?`,
    [userId, id],
  );
}

export async function getBranchIds(userId) {
  const [rows] = await pool.query('SELECT branch_id FROM user_branches WHERE user_id = ?', [userId]);
  return rows.map((row) => row.branch_id);
}

export async function setBranches(userId, branchIds) {
  await pool.query('DELETE FROM user_branches WHERE user_id = ?', [userId]);
  if (!branchIds || branchIds.length === 0) return;

  const values = branchIds.map((branchId) => [userId, branchId]);
  await pool.query('INSERT INTO user_branches (user_id, branch_id) VALUES ?', [values]);
}
