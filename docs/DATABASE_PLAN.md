# Clix Sales System — Database Plan

Database-first planning document and schema reference. The runnable DDL now exists as numbered migrations in [`backend/database/migrations/`](../backend/database/migrations/) (10 files, 42 tables, statically verified for FK-ordering correctness) plus seed data in [`backend/database/seeders/`](../backend/database/seeders/) and a combined [`backend/database/schema.sql`](../backend/database/schema.sql) — see [`backend/database/README.md`](../backend/database/README.md) for apply instructions and the reasoning behind the `branches`↔`users` circular-FK resolution and the deliberate omission of a seeded admin account. Engine: **MySQL 8**, InnoDB, `utf8mb4`.

---

## 1. Global Standards (apply to every table below unless noted)

- `id` — `BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`
- `created_at` — `DATETIME DEFAULT CURRENT_TIMESTAMP`
- `updated_at` — `DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
- `created_by` — `BIGINT UNSIGNED NULL`, FK → `users.id` (nullable for system-seeded rows)
- `updated_by` — `BIGINT UNSIGNED NULL`, FK → `users.id`
- `deleted_at` — `DATETIME NULL` (soft delete; applied to master/reference data and any table users can delete — not applied to immutable ledger tables like `inventory_movements`, `audit_logs`, `activity_logs`)
- All FKs use `ON DELETE RESTRICT` by default (protect referential/financial integrity) unless explicitly noted otherwise (e.g., `ON DELETE CASCADE` for pure child-line tables like `sale_items`).
- All money columns: `DECIMAL(14,2)` — never `FLOAT`/`DOUBLE`.
- All monetary/inventory writes across 2+ tables are wrapped in a single MySQL transaction.

Below, each table lists only its **domain-specific** columns; the global standard columns are implied.

---

## 2. Auth & Access Control

### `users`
- `first_name`, `last_name` VARCHAR(100)
- `gender` ENUM('male','female','other') NULL
- `phone` VARCHAR(20) UNIQUE
- `email` VARCHAR(150) UNIQUE
- `username` VARCHAR(50) UNIQUE
- `password_hash` VARCHAR(255)
- `role_id` BIGINT UNSIGNED → `roles.id`
- `branch_id` BIGINT UNSIGNED NULL → `branches.id` (primary/default branch; NULL for Super Admin)
- `avatar_path` VARCHAR(255) NULL
- `status` ENUM('active','suspended','locked') DEFAULT 'active'
- `failed_login_attempts` TINYINT UNSIGNED DEFAULT 0
- `locked_until` DATETIME NULL
- `last_login_at` DATETIME NULL
- Indexes: `email`, `username`, `phone` (unique), `role_id`, `branch_id`
- Business rule: inactive/suspended/locked/soft-deleted users cannot authenticate (checked in Auth Service, not just DB constraint)

### `user_branches` *(added — see PROJECT_PLAN §4)*
- `user_id` → `users.id`
- `branch_id` → `branches.id`
- Composite unique (`user_id`,`branch_id`)
- Purpose: many-to-many assignment for Managers who oversee multiple branches; Cashiers/Store Keepers typically rely on `users.branch_id` alone
- Pure join table: only `id`, the two FKs, and `created_at` — no `updated_by`/`updated_at`/`deleted_at` (rows are inserted/deleted, never updated)

### `roles`
- `name` VARCHAR(50) UNIQUE — seeded: Super Administrator, Manager, Cashier, Store Keeper; custom roles supported
- `description` VARCHAR(255) NULL
- `is_system` BOOLEAN DEFAULT FALSE (protects the 4 seeded roles from deletion)

### `permissions`
- `code` VARCHAR(100) UNIQUE — e.g. `products.create`, `purchases.approve`, `reports.export`
- `module` VARCHAR(50) — e.g. `products`, `purchases`, `reports`
- `action` VARCHAR(50) — view/create/edit/delete/approve/export/print/manage
- `description` VARCHAR(255) NULL

### `role_permissions`
- `role_id` → `roles.id`
- `permission_id` → `permissions.id`
- Composite unique (`role_id`,`permission_id`)
- Pure join table: only `id`, the two FKs, and `created_at` — same reasoning as `user_branches`

### `sessions`
- `user_id` → `users.id`
- `refresh_token_hash` VARCHAR(255)
- `ip_address` VARCHAR(45)
- `user_agent` VARCHAR(255)
- `device_label` VARCHAR(100) NULL
- `expires_at` DATETIME
- `revoked_at` DATETIME NULL
- Purpose: powers "Login Devices" list, "Logout Everywhere", device tracking

### `refresh_tokens`
- `user_id` → `users.id`
- `token_hash` VARCHAR(255) UNIQUE
- `session_id` → `sessions.id`
- `expires_at` DATETIME
- `revoked_at` DATETIME NULL

### `password_resets` *(added — required by "Password Reset via Email")*
- `user_id` → `users.id`
- `token_hash` VARCHAR(255) UNIQUE
- `expires_at` DATETIME
- `used_at` DATETIME NULL

---

## 3. Company & Branches

### `company_settings` *(single row, enforced in Service layer, not DB)*
- `company_name`, `business_type`, `tin_number`, `vrn`, `registration_number`
- `address`, `region`, `district`, `street`
- `phone`, `alt_phone`, `email`, `website`
- `logo_path` VARCHAR(255) NULL
- `currency` VARCHAR(10) DEFAULT 'TZS'
- `timezone` VARCHAR(50) DEFAULT 'Africa/Dar_es_Salaam'
- `receipt_footer` TEXT NULL
- `description` TEXT NULL
- `status` ENUM('active','inactive') DEFAULT 'active'
- Editable by Super Administrator only (enforced in permission layer)

### `branches`
- `name` VARCHAR(100)
- `code` VARCHAR(20) UNIQUE
- `manager_id` BIGINT UNSIGNED NULL → `users.id`
- `phone`, `email`, `address`, `region`, `district`
- `opening_date` DATE NULL
- `status` ENUM('active','inactive') DEFAULT 'active'
- Business rule: inactive branches cannot receive sales or purchases (enforced in Service layer)

---

## 4. Catalog & Inventory

### `categories`
- `name` VARCHAR(100) UNIQUE
- `code` VARCHAR(20) UNIQUE
- `description` VARCHAR(255) NULL
- `status` ENUM('active','inactive') DEFAULT 'active'
- Rule: delete blocked (soft) if any `products.category_id` references it

### `brands`
- `name` VARCHAR(100) UNIQUE
- `code` VARCHAR(20) UNIQUE
- `description` VARCHAR(255) NULL
- `country` VARCHAR(100) NULL
- `status` ENUM('active','inactive') DEFAULT 'active'
- Rule: delete blocked (soft) if any `products.brand_id` references it

### `products` *(shared catalog — one row per SKU, branch-agnostic per locked decision)*
- `name` VARCHAR(150)
- `code` VARCHAR(30) UNIQUE — generated via `document_sequences` (e.g. `SPR-2026-00001`)
- `category_id` → `categories.id`
- `brand_id` → `brands.id`
- `description` TEXT NULL
- `buying_price` DECIMAL(14,2)
- `selling_price` DECIMAL(14,2)
- `min_stock` INT UNSIGNED DEFAULT 0 — global default threshold; branch-level override lives on `inventory.min_stock` if a branch needs a different threshold
- `status` ENUM('active','inactive') DEFAULT 'active'
- Indexes: `code` (unique), `category_id`, `brand_id`, FULLTEXT(`name`)
- Rule: delete blocked if `sale_items`/`purchase_items`/`inventory_movements` reference it (transaction history exists) — deactivate instead

### `product_images`
- `product_id` → `products.id`
- `image_path` VARCHAR(255)
- `is_primary` BOOLEAN DEFAULT FALSE
- `sort_order` TINYINT UNSIGNED DEFAULT 0

### `qr_codes`
- `product_id` → `products.id`
- `qr_path` VARCHAR(255) — PNG file path
- `payload` JSON — encoded {product_id, code, branch_id, name, selling_price} snapshot at generation time
- `regenerated_count` INT UNSIGNED DEFAULT 0
- Purpose: history/audit trail for "Regenerate" requirement, not just a single current QR

### `document_sequences` *(added — reusable numbering engine, replaces a dedicated `product_codes` table)*
- `document_type` VARCHAR(30) — `PRODUCT_SPR`, `PRODUCT_DEC`, `SALE`, `PURCHASE`, `TRANSFER`, `RETURN`
- `year` SMALLINT UNSIGNED
- `last_number` INT UNSIGNED DEFAULT 0
- Composite unique (`document_type`,`year`)
- Access pattern: `SELECT ... FOR UPDATE` inside the owning transaction, increment, use — guarantees no duplicate/gap-free-enough numbering under concurrent POS terminals

### `inventory` *(per-branch stock — the single source of truth for quantity)*
- `product_id` → `products.id`
- `branch_id` → `branches.id`
- `quantity` INT UNSIGNED DEFAULT 0 — current on-hand
- `reserved_quantity` INT UNSIGNED DEFAULT 0 — future-ready (e.g. held sales)
- `min_stock` INT UNSIGNED NULL — branch-level override of `products.min_stock`
- `max_stock` INT UNSIGNED NULL — future-ready
- Composite unique (`product_id`,`branch_id`)
- Generated column `available_quantity` = `quantity - reserved_quantity` (or computed in query layer)
- Rule: **never written to directly by any UI form** — only mutated by the Inventory Service in response to a movement

### `inventory_movements` *(immutable ledger — no soft delete, no update after insert)*
- `product_id` → `products.id`
- `branch_id` → `branches.id`
- `movement_type` ENUM('purchase','sale','return','transfer_out','transfer_in','adjustment','opening_balance','manual_correction')
- `quantity_change` INT — signed (+in / -out)
- `previous_stock`, `new_stock` INT UNSIGNED
- `reference_type` VARCHAR(30), `reference_id` BIGINT UNSIGNED — polymorphic link to the originating sale/purchase/transfer/return/adjustment row
- `user_id` → `users.id`
- Index: (`product_id`,`branch_id`,`created_at`)

### `inventory_adjustments`
- `product_id` → `products.id`
- `branch_id` → `branches.id`
- `movement_id` → `inventory_movements.id`
- `reason` ENUM('damaged','expired','lost','correction','initial_count','system_error')
- `description` TEXT NULL
- `requires_approval` BOOLEAN DEFAULT FALSE
- `approved_by` BIGINT UNSIGNED NULL → `users.id`
- `approved_at` DATETIME NULL

---

## 5. Purchases & Suppliers

### `suppliers`
- `name` VARCHAR(150)
- `phone`, `email`, `address`
- `tin_number` VARCHAR(50) NULL
- `status` ENUM('active','inactive') DEFAULT 'active'

### `purchase_orders`
- `purchase_number` VARCHAR(30) UNIQUE — `PUR-2026-000001`
- `supplier_id` → `suppliers.id`
- `branch_id` → `branches.id`
- `total_amount` DECIMAL(14,2)
- `status` ENUM('pending','received','cancelled') DEFAULT 'received' (Phase 4 keeps this simple per spec; PO-approval workflow is not required by the spec beyond receiving)

### `purchase_items`
- `purchase_order_id` → `purchase_orders.id` (`ON DELETE CASCADE`)
- `product_id` → `products.id`
- `quantity` INT UNSIGNED
- `buying_price` DECIMAL(14,2)
- `line_total` DECIMAL(14,2)

### `supplier_payments`
- `supplier_id` → `suppliers.id`
- `purchase_order_id` BIGINT UNSIGNED NULL → `purchase_orders.id`
- `amount` DECIMAL(14,2)
- `payment_method` ENUM('cash','mpesa','airtel_money','bank_transfer')
- `paid_at` DATETIME
- Outstanding balance = `SUM(purchase_orders.total_amount) - SUM(supplier_payments.amount)`, computed in Service/Report layer, not stored redundantly

---

## 6. Sales (POS)

### `customers`
- `customer_code` VARCHAR(20) UNIQUE
- `first_name`, `last_name` VARCHAR(100)
- `business_name` VARCHAR(150) NULL
- `phone` VARCHAR(20) UNIQUE, `alt_phone` VARCHAR(20) NULL
- `email` VARCHAR(150) NULL
- `address`, `region`, `district`
- `tin_number` VARCHAR(50) NULL
- `customer_type` ENUM('walk_in','retail','wholesale','vip','business') DEFAULT 'walk_in'
- `status` ENUM('active','inactive') DEFAULT 'active'

### `sales`
- `sale_number` VARCHAR(30) UNIQUE — `SAL-2026-000001`
- `branch_id` → `branches.id`
- `customer_id` BIGINT UNSIGNED NULL → `customers.id` (nullable = walk-in without record)
- `cashier_id` → `users.id`
- `subtotal`, `discount_amount`, `tax_amount`, `total_amount` DECIMAL(14,2)
- `notes` VARCHAR(255) NULL
- `status` ENUM('completed','voided') DEFAULT 'completed'
- Index: (`branch_id`,`created_at`), `customer_id`, `cashier_id`

### `sale_items`
- `sale_id` → `sales.id` (`ON DELETE CASCADE`)
- `product_id` → `products.id`
- `quantity` INT UNSIGNED
- `unit_price` DECIMAL(14,2) — snapshot at time of sale (never re-reads `products.selling_price` later)
- `discount_amount` DECIMAL(14,2) DEFAULT 0
- `line_total` DECIMAL(14,2)

### `sale_payments`
- `sale_id` → `sales.id` (`ON DELETE CASCADE`)
- `payment_method` ENUM('cash','mpesa','airtel_money','bank_transfer','card')
- `amount` DECIMAL(14,2)
- `reference_number` VARCHAR(100) NULL — manual mobile-money reference entered by cashier
- Rule: `SUM(sale_payments.amount) >= sales.total_amount`, enforced in Service layer before commit

### `returns`
- `return_number` VARCHAR(30) UNIQUE — `RET-2026-000001`
- `sale_id` → `sales.id`
- `customer_id` BIGINT UNSIGNED NULL → `customers.id`
- `reason` ENUM('damaged','wrong_item','changed_mind','expired','other')
- `status` ENUM('pending','approved','rejected') DEFAULT 'pending'
- `approved_by` BIGINT UNSIGNED NULL → `users.id`
- `refund_amount` DECIMAL(14,2) NULL
- `refund_method` ENUM('cash','mpesa','airtel_money','bank_transfer') NULL
- `refund_status` ENUM('pending','refunded') NULL

### `return_items`
- `return_id` → `returns.id` (`ON DELETE CASCADE`)
- `sale_item_id` → `sale_items.id`
- `quantity` INT UNSIGNED
- Rule: `SUM(quantity)` per `sale_item_id` across all returns ≤ original `sale_items.quantity`

---

## 7. Stock Transfers

### `stock_transfer_requests`
- `transfer_number` VARCHAR(30) UNIQUE — `TRF-2026-000001`
- `source_branch_id` → `branches.id`
- `destination_branch_id` → `branches.id`
- `status` ENUM('pending','approved','rejected','completed') DEFAULT 'pending'
- `requested_by` → `users.id`
- `approved_by` BIGINT UNSIGNED NULL → `users.id`
- `approved_at` DATETIME NULL
- Constraint: `source_branch_id <> destination_branch_id` (checked in Service layer + CHECK constraint)

### `stock_transfer_items`
- `transfer_id` → `stock_transfer_requests.id` (`ON DELETE CASCADE`)
- `product_id` → `products.id`
- `quantity` INT UNSIGNED

---

## 8. Expenses

### `expense_categories`
- `name` VARCHAR(100) UNIQUE — seeded: Rent, Electricity, Water, Fuel, Salary, Maintenance, Transport, Office Supplies, Other

### `expenses`
- `expense_category_id` → `expense_categories.id`
- `branch_id` → `branches.id`
- `amount` DECIMAL(14,2)
- `description` VARCHAR(255) NULL
- `receipt_path` VARCHAR(255) NULL
- `paid_by` BIGINT UNSIGNED NULL → `users.id`
- `expense_date` DATE
- `status` ENUM('pending','approved') DEFAULT 'approved' (approval workflow future-ready; default auto-approved for Phase 6 per spec's simple scope)

---

## 9. Car Wash

### `vehicles`
- `plate_number` VARCHAR(20) UNIQUE
- `customer_name` VARCHAR(150)
- `phone` VARCHAR(20)

### `carwash_services`
- `name` VARCHAR(100) — Normal Wash, Full Wash, Engine Wash, Interior Cleaning
- `price` DECIMAL(14,2)
- `status` ENUM('active','inactive') DEFAULT 'active'

### `carwash_transactions`
- `vehicle_id` → `vehicles.id`
- `service_id` → `carwash_services.id`
- `branch_id` → `branches.id`
- `amount` DECIMAL(14,2)
- `payment_method` ENUM('cash','mpesa','airtel_money')
- `served_by` → `users.id`
- `status` ENUM('completed') DEFAULT 'completed'

---

## 10. System, Notifications & Audit

### `notifications`
- `user_id` BIGINT UNSIGNED NULL → `users.id` (NULL = broadcast to a role/branch, resolved in query layer)
- `type` ENUM('info','success','warning','danger')
- `category` ENUM('low_stock','purchase_completed','sale_completed','transfer_completed','expense_submitted','expense_approved','return_processed','system_error')
- `title` VARCHAR(150)
- `message` VARCHAR(500)
- `reference_type` VARCHAR(30) NULL, `reference_id` BIGINT UNSIGNED NULL
- `read_at` DATETIME NULL

### `activity_logs` *(human-readable timeline feed for Dashboard — no soft delete)*
- `user_id` → `users.id`
- `branch_id` BIGINT UNSIGNED NULL → `branches.id`
- `description` VARCHAR(255) — e.g. "Sale completed", "Stock transferred"
- `reference_type` VARCHAR(30) NULL, `reference_id` BIGINT UNSIGNED NULL

### `audit_logs` *(compliance/forensic trail — no soft delete, no update)*
- `user_id` → `users.id`
- `action` VARCHAR(100) — e.g. `product.price.update`, `purchase.approve`, `sale.delete`
- `table_name` VARCHAR(50)
- `record_id` BIGINT UNSIGNED
- `old_value` JSON NULL
- `new_value` JSON NULL
- `ip_address` VARCHAR(45)
- `branch_id` BIGINT UNSIGNED NULL → `branches.id`

### `system_settings` *(key/value app-wide config)*
- `setting_key` VARCHAR(100) UNIQUE — e.g. `tax_rate`, `low_stock_default_threshold`, `session_timeout_minutes`
- `setting_value` VARCHAR(500)
- `data_type` ENUM('string','number','boolean','json') DEFAULT 'string'

### `email_logs`
- `to_email` VARCHAR(150)
- `subject` VARCHAR(255)
- `template` VARCHAR(100) NULL
- `status` ENUM('sent','failed') 
- `error_message` VARCHAR(500) NULL

### `system_backups`
- `file_path` VARCHAR(255)
- `size_bytes` BIGINT UNSIGNED NULL
- `trigger_type` ENUM('manual','scheduled')
- `status` ENUM('success','failed')
- `triggered_by` BIGINT UNSIGNED NULL → `users.id`

---

## 11. Entity Relationship Summary (textual ERD)

```
roles ─┬─< role_permissions >─┬─ permissions
       └─< users >─┬─< user_branches >─┬─ branches ─┬─< sessions
                    │                                ├─< refresh_tokens
                    │                                ├─< sales
                    │                                ├─< purchase_orders
                    │                                ├─< expenses
                    │                                ├─< carwash_transactions
                    │                                └─< inventory (per branch)
                    ├─< sales (cashier_id)
                    ├─< audit_logs / activity_logs
                    └─< password_resets

categories ─< products >─┬─< product_images
brands     ─< products    ├─< qr_codes
                           ├─< inventory >─┬─ branches
                           │               └─< inventory_movements >─< inventory_adjustments
                           ├─< purchase_items >─ purchase_orders ─ suppliers ─< supplier_payments
                           ├─< sale_items >─ sales ─┬─ customers
                           │                        └─< sale_payments
                           ├─< return_items >─ returns ─ sales
                           └─< stock_transfer_items >─ stock_transfer_requests ─┬─ source branch
                                                                                 └─ destination branch

vehicles ─< carwash_transactions >─ carwash_services
expense_categories ─< expenses

document_sequences (standalone counter, referenced logically by sales/purchases/transfers/returns/products)
company_settings, system_settings (standalone singletons/config)
notifications (references users + polymorphic reference_type/reference_id)
```

---

## 12. Indexing Strategy

- Every FK column is indexed (MySQL does this automatically for InnoDB FKs).
- Every "searchable" column called out in the spec (`product name/code/QR`, `customer name/phone`, `sale/purchase/transfer number`) gets an explicit index; `products.name` and similarly free-text-searched columns get `FULLTEXT` where MySQL 8 supports it.
- Every reporting filter dimension (`branch_id`, `created_at`/date columns, `status`, `category_id`) is covered by a composite index matching the most common report query shape (e.g. `sales(branch_id, created_at)`).
- Unique constraints double as data-integrity guards: `products.code`, `branches.code`, `customers.phone`, `users.email/username`, sale/purchase/transfer/return numbers.

## 13. Transaction Boundaries (financial/inventory integrity)

Each of these is **one MySQL transaction** — any failure rolls back the entire operation, per the spec's explicit rule:

1. **Sale checkout** → `sales` + `sale_items` + `sale_payments` + `inventory` decrement + `inventory_movements` insert + `document_sequences` increment
2. **Purchase receiving** → `purchase_orders` + `purchase_items` + `inventory` increment + `inventory_movements` insert + `document_sequences` increment
3. **Transfer approval** → `inventory` decrement (source) + `inventory` increment (destination) + 2× `inventory_movements` insert + `stock_transfer_requests` status update
4. **Return approval** → `returns` + `return_items` + `inventory` increment + `inventory_movements` insert
5. **Stock adjustment** → `inventory_adjustments` + `inventory` update + `inventory_movements` insert
