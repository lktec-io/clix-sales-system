import { pool } from '../config/db.js';

// brands is a LEFT JOIN — brand is optional per-product (see the 013
// migration), and an INNER JOIN here would silently drop any product with
// no brand from every list/detail query the moment brand_id went NULL.
const BASE_SELECT = `
  SELECT p.*, c.name AS category_name, b.name AS brand_name
  FROM products p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN brands b ON b.id = p.brand_id
`;

export async function findById(id, tenantId) {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE p.id = ? AND p.tenant_id = ? AND p.deleted_at IS NULL LIMIT 1`, [id, tenantId]);
  if (!rows[0]) return null;

  const [images] = await pool.query(
    'SELECT id, image_path, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order',
    [id],
  );
  return { ...rows[0], images };
}

export async function findByCode(code, tenantId) {
  const [rows] = await pool.query('SELECT id, code FROM products WHERE code = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1', [code, tenantId]);
  return rows[0] || null;
}

// Purpose-built read for the POS product grid: active products joined with
// their stock at one specific branch. Kept separate from findAll() (which
// backs the Products admin list and has a different shape/purpose) and from
// inventory.repository's findAll() (which backs the Inventory admin list).
export async function findSellable({ tenantId, branchId, search, categoryId, limit = 60 }) {
  const conditions = ["p.deleted_at IS NULL", "p.status = 'active'", 'p.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(p.name LIKE ? OR p.code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (categoryId) {
    conditions.push('p.category_id = ?');
    params.push(categoryId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.code, p.selling_price, p.category_id, c.name AS category_name,
            p.brand_id, b.name AS brand_name,
            COALESCE(i.quantity - i.reserved_quantity, 0) AS available_quantity
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN inventory i ON i.product_id = p.id AND i.branch_id = ?
     ${whereClause}
     ORDER BY p.name
     LIMIT ?`,
    [branchId, ...params, limit],
  );
  return rows;
}

// Barcode-scan lookup — a genuinely different query from findSellable()'s
// `search`, which does a fuzzy `LIKE '%...%'` across both name and code and
// was never meant to resolve a single scanned value with certainty. This is
// an exact match on the one column that actually serves as this app's
// barcode (see the sale.repository.js / handleScan comments — there is no
// separate `barcode` column anywhere in the schema). products.code has a
// UNIQUE index and the table's collation (utf8mb4_unicode_ci) is already
// case-insensitive, so a plain `p.code = ?` on a trimmed input stays index-
// backed — wrapping the column itself in TRIM()/LOWER() would defeat that
// index and turn every scan into a full table scan as the catalog grows.
export async function findSellableByCode({ tenantId, code, branchId }) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.code, p.selling_price, p.category_id, c.name AS category_name,
            p.brand_id, b.name AS brand_name,
            COALESCE(i.quantity - i.reserved_quantity, 0) AS available_quantity
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN inventory i ON i.product_id = p.id AND i.branch_id = ?
     WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.code = ? AND p.tenant_id = ?
     LIMIT 1`,
    [branchId, code, tenantId],
  );
  return rows[0] || null;
}

export async function findAll({ tenantId, page = 1, limit = 20, search, categoryId, brandId, status }) {
  const conditions = ['p.deleted_at IS NULL', 'p.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(p.name LIKE ? OR p.code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (categoryId) {
    conditions.push('p.category_id = ?');
    params.push(categoryId);
  }
  if (brandId) {
    conditions.push('p.brand_id = ?');
    params.push(brandId);
  }
  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${BASE_SELECT} ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

// The Archived Products page's list — the mirror image of findAll()'s
// "deleted_at IS NULL": everything currently archived, newest-archived
// first so a Super Admin cleaning up sees their own recent actions on top.
export async function findAllArchived({ tenantId, page = 1, limit = 20, search }) {
  const conditions = ['p.deleted_at IS NOT NULL', 'p.tenant_id = ?'];
  const params = [tenantId];

  if (search) {
    conditions.push('(p.name LIKE ? OR p.code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `${BASE_SELECT} ${whereClause} ORDER BY p.deleted_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${whereClause}`, params);

  return { rows, total: countRows[0].total };
}

export async function findArchivedById(id, tenantId) {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE p.id = ? AND p.tenant_id = ? AND p.deleted_at IS NOT NULL LIMIT 1`, [id, tenantId]);
  if (!rows[0]) return null;

  const [images] = await pool.query(
    'SELECT id, image_path, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order',
    [id],
  );
  return { ...rows[0], images };
}

export async function restore(id, tenantId, userId) {
  await pool.query('UPDATE products SET deleted_at = NULL, updated_by = ? WHERE id = ? AND tenant_id = ?', [userId, id, tenantId]);
  return findById(id, tenantId);
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [tableName, columnName],
  );
  return rows.length > 0;
}

// Reads this database's *actual* foreign keys instead of a hardcoded table
// list — every table currently referencing products.id, whatever this
// specific deployment's schema happens to be (which migrations have or
// haven't been run manually is not something the delete path can safely
// assume). Returns [{ TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME }, ...].
async function findTablesReferencingProducts(connection) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME = 'products'
       AND REFERENCED_COLUMN_NAME = 'id'`,
  );
  return rows;
}

// sale_items and purchase_items are the only two referencing tables that
// represent real financial/audit history (see purgeProduct's comment) —
// every other table this database's own foreign keys report is treated as
// operational data and deleted outright, whatever it's actually called.
const PRESERVE_WITH_SNAPSHOT_TABLES = new Set(['sale_items', 'purchase_items']);

// Adds the name/code snapshot columns (and, for sale_items only, a cost
// snapshot — see the service layer's comment on why sale_items needs one
// and purchase_items doesn't) if they aren't already there, and relaxes
// the referencing column from NOT NULL/RESTRICT to NULL/SET NULL if it
// isn't already — checked and applied right here, at delete time, rather
// than depended on as a separate migration step someone has to remember to
// run first. Idempotent: a database that already has this shape does
// nothing here.
//
// Deliberately run on the plain pool, *before* any transaction starts, not
// on a transactional connection: ALTER TABLE causes an implicit commit in
// MySQL/InnoDB — running DDL partway through an explicit transaction
// silently ends it right there, so anything that transaction rolled back
// afterward wouldn't actually be undone the way it looks like it would.
// Keeping schema-healing (DDL) and the actual delete (DML, in
// purgeProduct below) as two separate steps is what keeps the delete a
// real all-or-nothing transaction.
// Two admins deleting different products within the same instant, on a
// database that hasn't been healed yet, could both see a column/constraint
// missing and both attempt to fix it — the loser of that race hits
// "duplicate column" / "can't drop it, already gone" from MySQL, not an
// actual problem (the schema ends up correct either way), so those two
// specific errors are swallowed here rather than failing the delete.
const TOLERATED_CONCURRENT_SCHEMA_ERRORS = new Set([
  'ER_DUP_FIELDNAME', // ADD COLUMN raced — the other caller already added it
  'ER_CANT_DROP_FIELD_OR_KEY', // DROP FOREIGN KEY raced — already dropped
  'ER_DUP_KEYNAME', // ADD CONSTRAINT raced — already added under this name
  'ER_FK_DUP_NAME',
]);

async function alterIgnoringConcurrentSchemaChange(sql) {
  try {
    await pool.query(sql);
  } catch (err) {
    if (!TOLERATED_CONCURRENT_SCHEMA_ERRORS.has(err.code)) throw err;
  }
}

async function ensureSnapshotCompatible(table, column, constraintName, includeBuyingPrice) {
  if (!(await columnExists(pool, table, 'product_name_snapshot'))) {
    await alterIgnoringConcurrentSchemaChange(`ALTER TABLE ${table} ADD COLUMN product_name_snapshot VARCHAR(150) NULL AFTER ${column}`);
  }
  if (!(await columnExists(pool, table, 'product_code_snapshot'))) {
    await alterIgnoringConcurrentSchemaChange(`ALTER TABLE ${table} ADD COLUMN product_code_snapshot VARCHAR(30) NULL AFTER product_name_snapshot`);
  }
  if (includeBuyingPrice && !(await columnExists(pool, table, 'buying_price_snapshot'))) {
    await alterIgnoringConcurrentSchemaChange(`ALTER TABLE ${table} ADD COLUMN buying_price_snapshot DECIMAL(14,2) NULL AFTER product_code_snapshot`);
  }

  const [[rule]] = await pool.query(
    `SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [table, constraintName],
  );
  if (rule?.DELETE_RULE !== 'SET NULL') {
    await pool.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} BIGINT UNSIGNED NULL`);
    await alterIgnoringConcurrentSchemaChange(`ALTER TABLE ${table} DROP FOREIGN KEY ${constraintName}`);
    await alterIgnoringConcurrentSchemaChange(
      `ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${column}) REFERENCES products (id) ON DELETE SET NULL`,
    );
  }
}

// Called once, before the delete transaction opens (see product.service.js)
// — inspects this database's real foreign keys and brings sale_items/
// purchase_items into a snapshot-compatible shape if they aren't already.
// A no-op on a database that's already compatible.
export async function ensureProductDeletionSchema() {
  const referencing = await findTablesReferencingProducts(pool);
  const preserve = referencing.filter((ref) => PRESERVE_WITH_SNAPSHOT_TABLES.has(ref.TABLE_NAME));
  for (const ref of preserve) {
    await ensureSnapshotCompatible(ref.TABLE_NAME, ref.COLUMN_NAME, ref.CONSTRAINT_NAME, ref.TABLE_NAME === 'sale_items');
  }
}

// True permanent removal — children first, parent last, one transaction,
// rollback on any failure. Pure DML: no DDL runs in here (see
// ensureProductDeletionSchema above for why that has to happen separately,
// first). Every table/column name used below comes from
// findTablesReferencingProducts()'s own query against this database's
// information_schema, not a hardcoded assumption — table identifiers can't
// be bound as query parameters, but they're safe to interpolate here
// because they originate from MySQL's own catalog for this exact
// column/id, never from external input.
//
// Two tiers, by design:
//  - sale_items / purchase_items (or whatever the schema calls them —
//    matched by name, not assumed to exist) are financial/audit records.
//    Their row survives; only the product_id link is cut. By the time this
//    runs, ensureProductDeletionSchema() has already made that possible.
//  - Every other table this database's foreign keys report is operational
//    stock-tracking data, not a financial record — deleting a product
//    legitimately means "this item no longer exists in the stock system
//    at all", so those rows are removed outright. Retried in passes
//    (rather than a fixed order) since some of them can reference each
//    other, and the real dependency graph is whatever this specific
//    database says it is — if a full pass makes no progress, whatever
//    MySQL's own error says about the last blocked table is what
//    propagates up, not a guess.
export async function purgeProduct({ id, name, code, buyingPrice }, connection) {
  const referencing = await findTablesReferencingProducts(connection);

  const preserve = referencing.filter((ref) => PRESERVE_WITH_SNAPSHOT_TABLES.has(ref.TABLE_NAME));
  for (const ref of preserve) {
    const includeBuyingPrice = ref.TABLE_NAME === 'sale_items';
    const setClauses = ['product_name_snapshot = ?', 'product_code_snapshot = ?'];
    const params = [name, code];
    if (includeBuyingPrice) {
      setClauses.push('buying_price_snapshot = ?');
      params.push(buyingPrice);
    }
    params.push(id);
    await connection.query(
      `UPDATE ${ref.TABLE_NAME} SET ${setClauses.join(', ')} WHERE ${ref.COLUMN_NAME} = ? AND product_name_snapshot IS NULL`,
      params,
    );
  }

  const seenTables = new Set();
  let remaining = referencing
    .filter((ref) => !PRESERVE_WITH_SNAPSHOT_TABLES.has(ref.TABLE_NAME))
    .filter((ref) => (seenTables.has(ref.TABLE_NAME) ? false : (seenTables.add(ref.TABLE_NAME), true)));

  while (remaining.length > 0) {
    const stillBlocked = [];
    let progressed = false;
    let lastError = null;

    for (const ref of remaining) {
      try {
        await connection.query(`DELETE FROM ${ref.TABLE_NAME} WHERE ${ref.COLUMN_NAME} = ?`, [id]);
        progressed = true;
      } catch (err) {
        if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
          stillBlocked.push(ref);
          lastError = err;
        } else {
          throw err;
        }
      }
    }

    if (!progressed) {
      // No further deletes succeeded this pass — genuinely stuck. MySQL's
      // own error already names the exact table/column/constraint
      // responsible; let it propagate rather than replacing it with a guess.
      throw lastError;
    }
    remaining = stillBlocked;
  }

  await connection.query('DELETE FROM products WHERE id = ?', [id]);
}

export async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO products (tenant_id, name, code, category_id, brand_id, description, buying_price, selling_price, min_stock, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tenantId, data.name, data.code, data.categoryId, data.brandId || null, data.description || null,
      data.buyingPrice, data.sellingPrice, data.minStock || 0, data.status || 'active',
      data.userId, data.userId,
    ],
  );
  return findById(result.insertId, data.tenantId);
}

export async function update(id, tenantId, data) {
  await pool.query(
    `UPDATE products SET name = ?, category_id = ?, brand_id = ?, description = ?,
       buying_price = ?, selling_price = ?, min_stock = ?, status = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`,
    [
      data.name, data.categoryId, data.brandId || null, data.description || null,
      data.buyingPrice, data.sellingPrice, data.minStock || 0, data.status, data.userId, id, tenantId,
    ],
  );
  return findById(id, tenantId);
}

export async function bulkUpdateStatus(ids, tenantId, status, userId) {
  await pool.query('UPDATE products SET status = ?, updated_by = ? WHERE id IN (?) AND tenant_id = ?', [status, userId, ids, tenantId]);
}

export async function softDelete(id, tenantId, userId) {
  await pool.query('UPDATE products SET deleted_at = NOW(), updated_by = ? WHERE id = ? AND tenant_id = ?', [userId, id, tenantId]);
}

// No longer a gate on whether delete is allowed (purgeProduct() above
// safely handles a product with or without history) — kept purely so the
// service layer can write an accurate activity-log line ("had sales/
// purchases, preserved via snapshot" vs. "never referenced by anything").
// Deliberately scoped to just the two snapshot-preserving tables (not
// every referencing table purgeProduct discovers) — a product_images or
// qr_codes row doesn't mean this product has real transaction history,
// just that someone uploaded a photo, and calling that "history" would
// make the resulting log line misleading. Still dynamic (never assumes
// sale_items/purchase_items exist), just filtered to the ones that matter
// for this specific message.
export async function hasTransactionHistory(id) {
  const referencing = await findTablesReferencingProducts(pool);
  const preserve = referencing.filter((ref) => PRESERVE_WITH_SNAPSHOT_TABLES.has(ref.TABLE_NAME));
  for (const ref of preserve) {
    const [[row]] = await pool.query(
      `SELECT 1 AS found FROM ${ref.TABLE_NAME} WHERE ${ref.COLUMN_NAME} = ? LIMIT 1`,
      [id],
    );
    if (row) return true;
  }
  return false;
}

export async function addImage(productId, imagePath, isPrimary) {
  if (isPrimary) {
    await pool.query('UPDATE product_images SET is_primary = FALSE WHERE product_id = ?', [productId]);
  }
  const [[{ maxOrder }]] = await pool.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS maxOrder FROM product_images WHERE product_id = ?',
    [productId],
  );
  const [result] = await pool.query(
    'INSERT INTO product_images (product_id, image_path, is_primary, sort_order) VALUES (?, ?, ?, ?)',
    [productId, imagePath, isPrimary, maxOrder],
  );
  return result.insertId;
}

export async function removeImage(imageId, productId) {
  await pool.query('DELETE FROM product_images WHERE id = ? AND product_id = ?', [imageId, productId]);
}

export async function findImageById(imageId) {
  const [rows] = await pool.query('SELECT * FROM product_images WHERE id = ? LIMIT 1', [imageId]);
  return rows[0] || null;
}
