import { pool } from '../config/db.js';

// Every lookup below returns a role only if it's a global system role
// (tenant_id IS NULL — the 4 seeded roles, shared by every tenant) OR a
// custom role owned by the caller's own tenant. This is the fix for a
// real cross-tenant leak: before 040_add_tenant_id_to_roles.sql, these
// queries had no tenant filter at all, so any tenant could see, edit, or
// delete any other tenant's custom roles by numeric id.
const OWNERSHIP_CLAUSE = '(tenant_id IS NULL OR tenant_id = ?)';

export async function findByName(name, tenantId) {
  const [rows] = await pool.query(
    `SELECT * FROM roles WHERE name = ? AND deleted_at IS NULL AND ${OWNERSHIP_CLAUSE} LIMIT 1`,
    [name, tenantId],
  );
  return rows[0] || null;
}

export async function findById(id, tenantId) {
  const [rows] = await pool.query(
    `SELECT * FROM roles WHERE id = ? AND deleted_at IS NULL AND ${OWNERSHIP_CLAUSE} LIMIT 1`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function findAll(tenantId) {
  const [rows] = await pool.query(
    `SELECT id, name, description, is_system FROM roles WHERE deleted_at IS NULL AND ${OWNERSHIP_CLAUSE} ORDER BY id`,
    [tenantId],
  );
  return rows;
}

export async function create({ name, description, userId, tenantId }) {
  const [result] = await pool.query(
    'INSERT INTO roles (tenant_id, name, description, is_system, created_by, updated_by) VALUES (?, ?, ?, FALSE, ?, ?)',
    [tenantId, name, description || null, userId, userId],
  );
  return findById(result.insertId, tenantId);
}

// Scoped to `tenant_id = ?` (never the OWNERSHIP_CLAUSE's OR-NULL form) —
// a tenant may only ever mutate its OWN custom roles, never a global
// system role, regardless of what the service-layer is_system check
// already blocks. This closes the same gap one layer deeper: even a
// system role's description was previously writable by any tenant admin
// with roles.edit, since only renaming was blocked above this repository.
export async function update(id, tenantId, { name, description, userId }) {
  await pool.query(
    'UPDATE roles SET name = ?, description = ?, updated_by = ? WHERE id = ? AND tenant_id = ?',
    [name, description || null, userId, id, tenantId],
  );
  return findById(id, tenantId);
}

export async function softDelete(id, tenantId, userId) {
  await pool.query('UPDATE roles SET deleted_at = NOW(), updated_by = ? WHERE id = ? AND tenant_id = ?', [userId, id, tenantId]);
}

export async function countUsersWithRole(id) {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE role_id = ? AND deleted_at IS NULL', [id]);
  return rows[0].total;
}
