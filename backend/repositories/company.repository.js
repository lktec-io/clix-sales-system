import { pool } from '../config/db.js';

export async function get(tenantId) {
  const [rows] = await pool.query('SELECT * FROM company_settings WHERE tenant_id = ? ORDER BY id ASC LIMIT 1', [tenantId]);
  return rows[0] || null;
}

export async function insert(data, connection = pool) {
  const [result] = await connection.query(
    `INSERT INTO company_settings
      (tenant_id, company_name, business_type, tin_number, vrn, registration_number, address, region, district, country, street,
       phone, alt_phone, email, website, logo_path, currency, timezone, receipt_footer, description, status,
       created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tenantId, data.companyName, data.businessType, data.tinNumber, data.vrn, data.registrationNumber,
      data.address, data.region, data.district, data.country || null, data.street,
      data.phone, data.altPhone, data.email, data.website, data.logoPath,
      data.currency, data.timezone, data.receiptFooter, data.description, data.status,
      data.userId, data.userId,
    ],
  );
  const [rows] = await connection.query('SELECT * FROM company_settings WHERE id = ? AND tenant_id = ? LIMIT 1', [result.insertId, data.tenantId]);
  return rows[0];
}

export async function update(id, tenantId, data) {
  await pool.query(
    `UPDATE company_settings SET
       company_name = ?, business_type = ?, tin_number = ?, vrn = ?, registration_number = ?,
       address = ?, region = ?, district = ?, street = ?,
       phone = ?, alt_phone = ?, email = ?, website = ?, currency = ?, timezone = ?,
       receipt_footer = ?, description = ?, status = ?, updated_by = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      data.companyName, data.businessType, data.tinNumber, data.vrn, data.registrationNumber,
      data.address, data.region, data.district, data.street,
      data.phone, data.altPhone, data.email, data.website, data.currency, data.timezone,
      data.receiptFooter, data.description, data.status, data.userId,
      id, tenantId,
    ],
  );
  return findById(id, tenantId);
}

export async function updateLogoPath(id, tenantId, logoPath) {
  await pool.query('UPDATE company_settings SET logo_path = ? WHERE id = ? AND tenant_id = ?', [logoPath, id, tenantId]);
  return findById(id, tenantId);
}

export async function findById(id, tenantId) {
  const [rows] = await pool.query('SELECT * FROM company_settings WHERE id = ? AND tenant_id = ? LIMIT 1', [id, tenantId]);
  return rows[0] || null;
}
