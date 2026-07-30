# API Reference

Base URL: `/api/v1`. Every response follows `{ success, message, data, errors }`; list endpoints return `data: { items, meta: { page, limit, total, totalPages } }`. See [ARCHITECTURE.md](ARCHITECTURE.md) for the request-handling pipeline.

**Auth**: Bearer access token in `Authorization: Bearer <token>`, obtained from `/auth/login` and refreshed via an httpOnly cookie against `/auth/refresh`. Endpoints below are grouped under a router; where the group has a blanket `authenticate`/`authorize()` at the top, only per-route *overrides* are noted — everything in that group requires at least what the group declares.

## `/auth` — no blanket gate; each route states its own requirement

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/login` | rate-limited (10/15min) | |
| POST | `/refresh` | cookie | rotates the refresh token |
| POST | `/logout` | cookie | |
| POST | `/logout-all` | authenticated | revokes every session |
| POST | `/forgot-password` | rate-limited | always 200, never reveals whether the email exists |
| POST | `/reset-password` | rate-limited | |
| GET | `/me` | authenticated | |
| GET | `/sessions` | authenticated | active sessions for the current user |
| DELETE | `/sessions/:id` | authenticated | |
| PUT | `/profile` | authenticated | self-service: name/phone/gender only |
| POST | `/profile/avatar` | authenticated | multipart |
| PATCH | `/change-password` | authenticated | requires current password; revokes all sessions on success |

## `/company` — no blanket gate

| Method | Path | Permission |
|---|---|---|
| GET | `/` | none (public within the app — needed pre-login for branding) |
| PUT | `/` | `company.manage` |
| POST | `/logo` | `company.manage` |

## `/users` — `authenticate`

| Method | Path | Permission |
|---|---|---|
| GET | `/`, `/:id` | `users.view` |
| POST | `/` | `users.create` |
| PUT | `/:id` | `users.edit` |
| PATCH | `/:id/status`, `/:id/password` | `users.edit` |
| DELETE | `/:id` | `users.delete` |
| POST | `/:id/avatar` | `users.edit` |

## `/branches` — `authenticate`

| Method | Path | Permission |
|---|---|---|
| GET | `/active` | none beyond auth (dropdown lookup) |
| GET | `/`, `/:id` | `branches.view` |
| POST | `/` | `branches.create` |
| PUT | `/:id` | `branches.edit` |
| PATCH | `/:id/status` | `branches.edit` |

## `/roles` — `authenticate`

| Method | Path | Permission |
|---|---|---|
| GET | `/` | none beyond auth |
| GET | `/permissions/catalog`, `/:id/permissions` | `roles.view` |
| POST | `/` | `roles.create` |
| PUT | `/:id` | `roles.edit` |
| DELETE | `/:id` | `roles.delete` |
| PUT | `/:id/permissions` | `roles.manage` |

## `/dashboard` — `authenticate` + `dashboard.view`

| Method | Path |
|---|---|
| GET | `/kpis` |
| GET | `/charts/:type` |
| GET | `/activity` |

## `/search` — `authenticate`

| Method | Path |
|---|---|
| GET | `/` — global search (currently Users only) |

## `/categories`, `/brands` — `authenticate`

Identical shape for both:

| Method | Path | Permission |
|---|---|---|
| GET | `/active` | none beyond auth |
| GET | `/` | `<module>.view` |
| POST | `/` | `<module>.create` |
| PUT | `/:id` | `<module>.edit` |
| DELETE | `/:id` | `<module>.delete` |

## `/products` — `authenticate`

| Method | Path | Permission |
|---|---|---|
| GET | `/` | `products.view` |
| GET | `/sellable` | `products.view` — branch-scoped, backs the POS grid |
| GET | `/:id` | `products.view` |
| POST | `/` | `products.create` |
| PUT | `/:id` | `products.edit` |
| PATCH | `/bulk-status` | `products.manage` |
| DELETE | `/:id` | `products.delete` |
| POST | `/:id/images` | `products.edit` |
| DELETE | `/:id/images/:imageId` | `products.edit` |
| GET | `/:id/qr` | `products.view` |
| POST | `/:id/qr/regenerate` | `products.manage` |
| POST | `/labels` (bulk) | `products.print` |
| GET | `/:id/label` | `products.print` |

## `/inventory` — `authenticate` + `inventory.view`

| Method | Path | Permission |
|---|---|---|
| GET | `/`, `/summary`, `/movements` | (group default) |
| POST | `/adjustments` | `inventory.adjust` |

## `/suppliers` — `authenticate`

| Method | Path | Permission |
|---|---|---|
| GET | `/active` | none beyond auth |
| GET | `/`, `/:id`, `/:id/purchases` | `suppliers.view` |
| POST | `/` | `suppliers.create` |
| PUT | `/:id` | `suppliers.edit` |
| PATCH | `/:id/status` | `suppliers.edit` |

## `/purchases` — `authenticate` + `purchases.view`

| Method | Path | Permission |
|---|---|---|
| GET | `/`, `/:id` | (group default) |
| POST | `/` | `purchases.create` — transactional, see [ARCHITECTURE.md](ARCHITECTURE.md) |
| POST | `/payments` | `purchases.manage` |

## `/transfers` — `authenticate` + `transfers.view`

| Method | Path | Permission |
|---|---|---|
| GET | `/`, `/:id` | (group default) |
| POST | `/` | `transfers.create` — creates a `pending` request, no stock impact yet |
| POST | `/:id/approve` | `transfers.approve` — transactional dual-branch stock move |
| POST | `/:id/reject` | `transfers.approve` |

## `/customers` — `authenticate`

| Method | Path | Permission |
|---|---|---|
| GET | `/active` | none beyond auth |
| GET | `/`, `/:id`, `/:id/purchases`, `/:id/returns` | `customers.view` |
| POST | `/` | `customers.create` |
| PUT | `/:id` | `customers.edit` |
| PATCH | `/:id/status` | `customers.edit` |

## `/sales` — `authenticate` + `sales.view`

| Method | Path | Permission |
|---|---|---|
| GET | `/`, `/:id`, `/:id/receipt` | (group default) — receipt streams a PDF |
| POST | `/` | `sales.create` — POS checkout, transactional |

## `/returns` — `authenticate` + `returns.view`

| Method | Path | Permission |
|---|---|---|
| GET | `/`, `/:id` | (group default) |
| POST | `/` | `returns.create` |
| POST | `/:id/approve`, `/:id/reject` | `returns.approve` |

## `/expenses` — `authenticate` + `expenses.view`

| Method | Path | Permission |
|---|---|---|
| GET | `/categories`, `/`, `/:id` | (group default) |
| POST | `/` | `expenses.create` |
| PUT | `/:id` | `expenses.edit` |
| DELETE | `/:id` | `expenses.delete` |

## `/reports` — `authenticate` + `reports.view`

| Method | Path |
|---|---|
| GET | `/:type` — `type` ∈ `sales, inventory, purchases, expenses, profit, branches, products, customers, suppliers, returns, transfers`; query params: `dateFrom`, `dateTo`, `branchId`, `categoryId`, `supplierId`, `cashierId` (accepted by some report types, not all — see `report.service.js`) |

## `/notifications` — `authenticate`, no permission gate (every user manages their own inbox)

| Method | Path |
|---|---|
| GET | `/` — query: `status` ∈ `unread`, `read`, or omitted for all |
| GET | `/unread-count` |
| PATCH | `/:id/read` |
| PATCH | `/read-all` |

## `/settings` — `authenticate` + `settings.view`

| Method | Path | Permission |
|---|---|---|
| GET | `/system`, `/backups` | (group default) |
| PUT | `/system` | `settings.manage` |
| POST | `/backups` | `settings.manage` — triggers `mysqldump`, synchronous |
| GET | `/backups/:id/download` | `settings.manage` — streams the `.sql` file |

## Errors

| Status | Meaning |
|---|---|
| 400 | Validation failure or a business precondition not met (e.g. "Selected supplier does not exist") |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but lacking the required permission, or branch-scope violation |
| 404 | Resource not found |
| 409 | Conflict — duplicate unique key, or a two-step workflow item already processed by someone else |
| 422 | Semantically invalid (e.g. "would result in negative stock", "discount exceeds your permitted limit") |
| 429 | Rate limited |
| 500 | Unexpected server error — message is always generic; never leaks stack traces or raw SQL |
