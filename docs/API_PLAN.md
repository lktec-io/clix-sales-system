# Clix Sales System — API Plan

Contract-level plan for the REST API, updated as each phase ships real route handlers (see `docs/CHANGELOG.md` for what's actually implemented vs. still planned below). Base path: `/api/v1`.

---

## 1. Conventions

**Response envelope** (every endpoint, success or failure):
```json
{ "success": true, "message": "string", "data": {}, "errors": [] }
```
- `errors` is populated (array of `{ field, message }`) only on validation failures.
- Stack traces and raw SQL errors are never returned — centralized error handler maps to safe messages.

**List endpoints** support these query params uniformly:
- `page`, `limit` (pagination)
- `sort` (e.g. `sort=-created_at` for descending)
- `search` (matches the resource's designated searchable columns)
- Resource-specific filters (documented per module below)
- Response shape: `data` is `{ items: [...], meta: { page, limit, total, totalPages } }` — established in Phase 3's Users endpoint, followed by every list endpoint since.

**Auth header:** `Authorization: Bearer <access_token>` on every protected route. Refresh token travels as an httpOnly cookie, never in the body/header.

**Every protected endpoint requires, in order:** JWT auth → permission check (`module.action` code from `permissions`) → validation → controller → service → repository. Branch-scoped resources are further filtered by the authenticated user's accessible branch(es) unless the user is Super Admin.

**Standard HTTP verbs:** `GET` (read), `POST` (create), `PUT` (full update), `PATCH` (partial update / status change), `DELETE` (soft delete).

---

## 2. Auth — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Email/username + password → access token + refresh cookie |
| POST | `/auth/refresh` | Refresh cookie | Issue new access token, rotate refresh token |
| POST | `/auth/logout` | Authenticated | Revoke current session |
| POST | `/auth/logout-all` | Authenticated | Revoke all sessions for the user |
| POST | `/auth/forgot-password` | Public | Send reset email |
| POST | `/auth/reset-password` | Public (token in body) | Consume reset token, set new password |
| GET | `/auth/me` | Authenticated | Current user + role + permissions + branch(es) |
| GET | `/auth/sessions` | Authenticated | List active devices/sessions |
| DELETE | `/auth/sessions/:id` | Authenticated | Revoke a specific device session |

## 3. Users — `/api/v1/users`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/users` | `users.view` | Paginated list, filters: `role_id`, `branch_id`, `status` |
| POST | `/users` | `users.create` | Create user |
| GET | `/users/:id` | `users.view` | User detail |
| PUT | `/users/:id` | `users.edit` | Update user |
| PATCH | `/users/:id/status` | `users.edit` | Activate / suspend / lock |
| DELETE | `/users/:id` | `users.delete` | Soft delete |
| PATCH | `/users/:id/password` | `users.edit` | Admin-triggered password reset |
| PATCH | `/users/:id/role` | `users.manage` | Change role |
| PATCH | `/users/:id/branches` | `users.manage` | Assign branch(es) |
| GET | `/users/:id/activity` | `users.view` | User's activity log |

## 4. Roles & Permissions — `/api/v1/roles`, `/api/v1/permissions`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/roles` | `roles.view` | List roles |
| POST | `/roles` | `roles.create` | Create custom role |
| PUT | `/roles/:id` | `roles.edit` | Update role (blocked for `is_system` name change) |
| DELETE | `/roles/:id` | `roles.delete` | Delete (blocked if users assigned or `is_system`) |
| GET | `/permissions` | `roles.view` | Full permission catalog |
| GET | `/roles/:id/permissions` | `roles.view` | Permissions assigned to a role |
| PUT | `/roles/:id/permissions` | `roles.manage` | Replace role's permission set |

## 5. Branches — `/api/v1/branches`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/branches` | `branches.view` | List (scoped to user's access unless Super Admin) |
| POST | `/branches` | `branches.create` | Create branch |
| GET | `/branches/:id` | `branches.view` | Detail |
| PUT | `/branches/:id` | `branches.edit` | Update |
| PATCH | `/branches/:id/status` | `branches.edit` | Activate/deactivate |
| GET | `/branches/:id/performance` | `branches.view` | KPI summary for branch |

## 6. Company & System Settings — `/api/v1/company`, `/api/v1/settings`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/company` | Authenticated | Read company profile (used app-wide for logo/name) |
| PUT | `/company` | `company.manage` (Super Admin) | Update profile |
| POST | `/company/logo` | `company.manage` | Upload logo (Multer, type/size validated) |
| GET | `/settings` | `settings.view` | List system settings |
| PUT | `/settings` | `settings.manage` | Bulk update key/value settings |
| POST | `/settings/backup` | `settings.manage` | Trigger manual backup |
| GET | `/settings/backups` | `settings.view` | Backup history |

## 7. Profile — `/api/v1/profile`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/profile` | Authenticated | Own profile |
| PUT | `/profile` | Authenticated | Update own info |
| POST | `/profile/avatar` | Authenticated | Upload avatar |
| PATCH | `/profile/password` | Authenticated | Change own password |
| GET | `/profile/activity` | Authenticated | Own recent activity |
| GET | `/profile/sessions` | Authenticated | Own login devices |

## 8. Dashboard — `/api/v1/dashboard`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/dashboard/kpis` | `dashboard.view` | All KPI card values (branch-scoped) |
| GET | `/dashboard/charts/:type` | `dashboard.view` | `sales-trend`, `revenue-trend`, `expense-trend`, `profit-trend`, `top-products`, `branch-performance`, `inventory-summary`, `carwash-summary` |
| GET | `/dashboard/activity` | `dashboard.view` | Recent activity timeline (sales/purchases/expenses/transfers/logins) |
| GET | `/search` | Authenticated | Global search across products/customers/suppliers/sales/purchases/vehicles/expenses/users |

## 9. Categories — `/api/v1/categories`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/categories` | `categories.view` | List (search, filter, paginate) |
| POST | `/categories` | `categories.create` | Create |
| PUT | `/categories/:id` | `categories.edit` | Update |
| DELETE | `/categories/:id` | `categories.delete` | Soft delete (blocked if products reference it) |

## 10. Brands — `/api/v1/brands`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/brands` | `brands.view` | List |
| POST | `/brands` | `brands.create` | Create |
| PUT | `/brands/:id` | `brands.edit` | Update |
| DELETE | `/brands/:id` | `brands.delete` | Soft delete (blocked if products reference it) |

## 11. Products — `/api/v1/products`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/products` | `products.view` | List — filters: `category_id`, `brand_id`, `branch_id`, `status`, `low_stock`, `out_of_stock`, `price_min`, `price_max` |
| POST | `/products` | `products.create` | Create (auto-generates code + QR) |
| GET | `/products/:id` | `products.view` | Detail |
| PUT | `/products/:id` | `products.edit` | Update |
| DELETE | `/products/:id` | `products.delete` | Soft delete / deactivate (blocked if transaction history exists) |
| POST | `/products/:id/images` | `products.edit` | Upload image(s) |
| DELETE | `/products/:id/images/:imageId` | `products.edit` | Remove image |
| PATCH | `/products/bulk-status` | `products.manage` | Bulk activate/deactivate |
| POST | `/products/bulk-export` | `products.export` | Excel/CSV/PDF export |
| GET | `/products/:id/qr` | `products.view` | Current QR (PNG) |
| POST | `/products/:id/qr/regenerate` | `products.manage` | Regenerate QR |
| POST | `/products/labels` | `products.print` | Bulk label PDF (list of product IDs) |
| GET | `/products/:id/label` | `products.print` | Single label PDF |

## 12. Inventory — `/api/v1/inventory`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/inventory` | `inventory.view` | Per-branch stock list — filters: `branch_id`, `low_stock`, `out_of_stock` |
| GET | `/inventory/summary` | `inventory.view` | Total products / value / low / out counts |
| GET | `/inventory/movements` | `inventory.view` | Movement ledger — filters: `product_id`, `branch_id`, `movement_type`, date range |
| POST | `/inventory/adjustments` | `inventory.adjust` | Create stock adjustment |
| GET | `/inventory/adjustments` | `inventory.view` | Adjustment history |
| PATCH | `/inventory/adjustments/:id/approve` | `inventory.approve` | Approve adjustment (if `requires_approval`) |

## 13. Suppliers — `/api/v1/suppliers`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/suppliers` | `suppliers.view` | List |
| POST | `/suppliers` | `suppliers.create` | Create |
| GET | `/suppliers/:id` | `suppliers.view` | Detail |
| PUT | `/suppliers/:id` | `suppliers.edit` | Update |
| PATCH | `/suppliers/:id/status` | `suppliers.edit` | Deactivate |
| GET | `/suppliers/:id/purchases` | `suppliers.view` | Purchase history |
| GET | `/suppliers/:id/balance` | `suppliers.view` | Outstanding balance |

## 14. Purchases — `/api/v1/purchases`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/purchases` | `purchases.view` | List — filters: `supplier_id`, `branch_id`, date range |
| POST | `/purchases` | `purchases.create` | Create purchase (transaction: order + items + inventory + movement) |
| GET | `/purchases/:id` | `purchases.view` | Detail |
| POST | `/purchases/:id/payments` | `purchases.manage` | Record supplier payment |

## 15. Stock Transfers — `/api/v1/transfers`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/transfers` | `transfers.view` | List — filters: `source_branch_id`, `destination_branch_id`, `status` |
| POST | `/transfers` | `transfers.create` | Create request (pending) |
| GET | `/transfers/:id` | `transfers.view` | Detail |
| PATCH | `/transfers/:id/approve` | `transfers.approve` | Approve → dual inventory update (transaction) |
| PATCH | `/transfers/:id/reject` | `transfers.approve` | Reject |

## 16. Customers — `/api/v1/customers`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/customers` | `customers.view` | List — filter: `customer_type`, `status` |
| POST | `/customers` | `customers.create` | Create |
| GET | `/customers/:id` | `customers.view` | Detail |
| PUT | `/customers/:id` | `customers.edit` | Update |
| PATCH | `/customers/:id/status` | `customers.edit` | Deactivate |
| GET | `/customers/:id/sales` | `customers.view` | Purchase history |
| GET | `/customers/:id/returns` | `customers.view` | Return history |

## 17. POS / Sales — `/api/v1/sales`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/sales` | `sales.view` | List — filters: `branch_id`, `cashier_id`, `customer_id`, `payment_method`, `status`, date range |
| POST | `/sales` | `sales.create` | Checkout (single transaction: sale + items + payments + inventory + movements + logs + notifications) |
| GET | `/sales/:id` | `sales.view` | Detail (items, payments, discounts, movements, logs) |
| GET | `/sales/:id/receipt` | `sales.view` | Receipt data (for print/PDF) |
| GET | `/sales/:id/receipt/pdf` | `sales.view` | Receipt as PDF |
| POST | `/sales/lookup` | `sales.create` | Product lookup by name/code/QR for POS search |

## 18. Returns — `/api/v1/returns`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/returns` | `returns.view` | List — filters: `status`, `customer_id`, date range |
| POST | `/returns` | `returns.create` | Create return request |
| GET | `/returns/:id` | `returns.view` | Detail |
| PATCH | `/returns/:id/approve` | `returns.approve` | Approve → restore inventory (transaction) |
| PATCH | `/returns/:id/reject` | `returns.approve` | Reject |

## 19. Expenses — `/api/v1/expenses`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/expenses` | `expenses.view` | List — filters: `category_id`, `branch_id`, date range |
| POST | `/expenses` | `expenses.create` | Create (with optional receipt upload) |
| PUT | `/expenses/:id` | `expenses.edit` | Update |
| DELETE | `/expenses/:id` | `expenses.delete` | Soft delete |
| GET | `/expense-categories` | `expenses.view` | Category list |

## 20. Car Wash — `/api/v1/carwash`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/carwash/vehicles` | `carwash.view` | List/search vehicles |
| POST | `/carwash/vehicles` | `carwash.create` | Register vehicle |
| GET | `/carwash/services` | `carwash.view` | Service catalog |
| POST | `/carwash/transactions` | `carwash.create` | Record wash + payment |
| GET | `/carwash/transactions` | `carwash.view` | History — filters: `branch_id`, `service_id`, date range |

## 21. Reports — `/api/v1/reports`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/reports/sales` | `reports.view` | Sales report (shared filter set) |
| GET | `/reports/inventory` | `reports.view` | Inventory / stock movement report |
| GET | `/reports/purchases` | `reports.view` | Purchases report |
| GET | `/reports/expenses` | `reports.view` | Expenses report |
| GET | `/reports/carwash` | `reports.view` | Car wash report |
| GET | `/reports/profit` | `reports.view` | Profit & loss report |
| GET | `/reports/branches` | `reports.view` | Branch comparison report |
| GET | `/reports/customers` | `reports.view` | Customer report |
| GET | `/reports/suppliers` | `reports.view` | Supplier report |
| GET | `/reports/returns` | `reports.view` | Returns report |
| GET | `/reports/transfers` | `reports.view` | Transfers report |
| GET | `/reports/activity` | `reports.view` | Activity report |
| GET | `/reports/audit` | `reports.view` (Super Admin) | Audit report |
| GET | `/reports/:type/export/pdf` | `reports.export` | PDF export (shared filters as query params) |
| GET | `/reports/:type/export/excel` | `reports.export` | Excel export |
| GET | `/reports/:type/export/csv` | `reports.export` | CSV export |

Every `/reports/*` endpoint accepts the same filter contract: `date_from`, `date_to`, `branch_id`, `user_id`, `category_id`, `supplier_id`, `customer_id`, `product_id`, `payment_method`, `status`, `search`.

## 22. Notifications — `/api/v1/notifications`

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/notifications` | Authenticated | List (own/role/branch-scoped), filter `read`/`unread` |
| PATCH | `/notifications/:id/read` | Authenticated | Mark one as read |
| PATCH | `/notifications/read-all` | Authenticated | Mark all as read |
| DELETE | `/notifications/:id` | Authenticated | Delete |

---

## 23. Error Codes (consistent across all endpoints)

| HTTP Status | Meaning |
|---|---|
| 400 | Validation failure (`errors[]` populated) |
| 401 | Missing/expired/invalid token |
| 403 | Authenticated but lacks permission |
| 404 | Resource not found |
| 409 | Conflict (duplicate code/email/username, business-rule violation) |
| 422 | Semantically invalid (e.g. return quantity exceeds sold quantity) |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error (generic message only, logged internally via Winston) |
