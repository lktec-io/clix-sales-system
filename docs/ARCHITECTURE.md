# Architecture

As-built reference for Clix Sales System. For the phase-by-phase build history, see [CHANGELOG.md](CHANGELOG.md). For the original plan, see [PROJECT_PLAN.md](PROJECT_PLAN.md).

## Stack

- **Frontend**: React 19 + Vite, React Router DOM 7, Axios, React Hook Form, Chart.js + react-chartjs-2, html5-qrcode, Framer Motion, React Icons. Pure CSS (no UI framework) — see [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) for the full `src/styles/` breakdown.
- **Backend**: Node.js + Express 5, MySQL 8 (`mysql2`), JWT auth, `express-validator`, Helmet, `express-rate-limit`, Multer, `node-cron`, Nodemailer, `pdfkit`, `qrcode`, Winston.
- **Database**: MySQL, all access through parameterized queries via `mysql2`'s connection pool — no ORM.

## Backend layering

Every request flows through the same five layers, no exceptions:

```
Router → Validation → authenticate → authorize(permission) → Controller (thin) → Service (business logic) → Repository (all SQL) → Database
```

- **Router** (`backend/routes/*.routes.js`): wires middleware order for each endpoint. Convention: `router.use(authenticate, authorize('<module>.view'))` at the top of the file, then per-route `authorize()` overrides for create/edit/delete/approve actions.
- **Validation** (`backend/validators/*.validator.js` + `validateRequest` middleware): `express-validator` chains; runs before the controller ever sees the request.
- **Controller** (`backend/controllers/*.controller.js`): thin — extracts `req.params`/`req.query`/`req.body`/`req.user`, calls exactly one service function, wraps the result in the standard response envelope. No business logic here.
- **Service** (`backend/services/*.service.js`): all business logic — validation beyond shape-checking, branch-scoping, transaction orchestration, cross-module effects (activity logs, notifications).
- **Repository** (`backend/repositories/*.repository.js`): all SQL. Every query is parameterized (`?` placeholders); no string-interpolated user input ever reaches a query.

## Core reusable patterns

These four pieces of infrastructure are used by nearly every module and are the load-bearing abstractions in this codebase:

### `inventory.repository.recordMovement(data, connection?)`
The single source of truth for every stock mutation. Locks the inventory row with `SELECT ... FOR UPDATE`, creates the row on first touch, rejects negative stock with a 422, updates quantity, inserts an immutable `inventory_movements` record, and returns `{ movementId, previousStock, newStock, minStock, crossedIntoLowStock }`. Accepts an optional external connection so callers can compose it into their own larger transaction (Purchases increase stock once per line; Transfers call it twice per line, once at each branch; POS decreases stock once per line; Returns increase stock once per line). `crossedIntoLowStock` (added in Phase 22) lets callers fire a low-stock notification exactly once per dip rather than on every subsequent sale of an already-low item.

**Never bypass this function to touch the `inventory` table directly.** Every module that changes stock — Purchases, POS, Transfers, Returns, manual Adjustments — goes through it, which is what makes the `inventory_movements` ledger a complete, trustworthy audit trail.

### `sequence.repository.generateCode(documentType, prefix, { padLength })`
Atomic, collision-free document numbering (`PUR-2026-000001`, `SAL-2026-000001`, etc.) using MySQL's `INSERT ... VALUES (..., LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)` idiom — safe under concurrent callers without an explicit application-level lock. `LAST_INSERT_ID(1)` must appear on the `INSERT` branch too, not just the `UPDATE` branch, or the first code for a new `(documentType, year)` pair returns the wrong value.

### `branchScope.getAccessibleBranchIds(user)`
Returns `null` for Super Administrator (unrestricted) or an array of accessible branch IDs otherwise (primary `branch_id` plus any rows in `user_branches` for multi-branch Managers). Every branch-owned module's list/read query calls this and appends `AND branch_id IN (?)` when the result isn't `null`. Write operations use the same result to reject cross-branch access with a 403.

### `permission.repository.getCodesForRole(roleId)` + `authorize(code)`
RBAC is role-based, not user-based — permissions attach to roles, roles attach to users. The `authorize()` middleware caches a role's permission codes for 60 seconds to avoid a query on every request; `invalidatePermissionCache()` is called whenever role-permission assignments change. Some services (Sale checkout's discount-authority check) call `getCodesForRole()` directly rather than through the middleware, when a business decision — not just route access — depends on a permission.

## Transaction safety

Every multi-step write that touches money or stock is wrapped in an explicit MySQL transaction: `pool.getConnection()` → `beginTransaction()` → every write on that connection → `commit()` → `release()` in `finally`, with `rollback()` in `catch`. This applies to: Purchases (Phase 14), Transfers' approval (Phase 15), POS checkout (Phase 17), Returns' approval (Phase 18). Post-commit side effects (activity logs, notifications) always run *after* `commit()` succeeds, never before — a notification must never describe a change that could still be rolled back.

Because no live database exists during development (see [TESTING.md](TESTING.md)), every one of these transactions was verified by monkey-patching `pool.getConnection`/`pool.query` with a simulated `PoolConnection` and exercising the real, unmodified service function directly — asserting the exact call order on both the success path and a simulated mid-transaction failure.

## Response envelope

Every API response follows `{ success, message, data, errors }`. Errors never leak stack traces or raw SQL — `middlewares/errorHandler.js` catches `ApiError` instances (thrown deliberately by services, carrying a status and message) and converts unexpected errors (including MySQL's `ER_DUP_ENTRY`) into a generic, safe response.

List endpoints return a consistent pagination envelope: `data: { items: [...], meta: { page, limit, total, totalPages } }`.

## Frontend structure

- **`src/pages/<module>/`**: one folder per module, typically `List`, `Form` or modal-based create/edit, and `Detail` where the module has enough state to warrant a dedicated page (Purchases, Transfers, POS/Sales, Returns). Simpler modules (Categories, Brands, Customers, Suppliers, Expenses) use a list page with an inline modal for create/edit instead of separate routes.
- **`src/hooks/useTable.js`**: the shared list-page hook — pagination, debounced search, arbitrary filters, sort — wired to any service function shaped as `fetchFn(params) -> { items, meta }`.
- **`src/components/common/`**: `Table`, `Pagination`, `SearchInput`, `Modal`, `ConfirmDialog`, `QRScanner`, `SettingsTabs` — reused across every module rather than reimplemented.
- **Route-level code splitting**: every page is `React.lazy()`-loaded behind a single `<Suspense>` boundary in `AppRouter.jsx`. Introduced in Phase 5 once the bundle crossed 500KB; every subsequent phase's pages follow the same pattern automatically.
- **RBAC in the UI**: `usePermission(code)` (backed by `AuthContext.hasPermission`) gates buttons and routes client-side — this is a UX convenience, not a security boundary. The actual boundary is server-side `authorize()`; a hidden button is not a substitute for a permission check the API also enforces.

## Module dependency graph

Modules build on each other in the order they shipped, and the dependency direction has never reversed:

```
Auth → Company/Users/Roles/Branches → Dashboard (reads everything downstream)
Categories/Brands → Products → Inventory (recordMovement) → QR Codes → Labels
Suppliers → Purchases (recordMovement, increases stock)
Transfers (recordMovement × 2, moves stock between branches)
Customers → POS/Sales (recordMovement, decreases stock; QRScanner; discount authority)
Returns (recordMovement, restores stock; refund computed from the sale's actual paid price)
Expenses (no inventory impact — simple branch-scoped CRUD/append-only logs)
Reports (aggregates every table above — no new tables, only queries)
Notifications (reaches back into Purchases/POS/Transfers/Expenses/Returns to add triggers)
Settings (Tax/Email config, backups, self-service Profile/Password)
```

Dashboard (Phase 6) and Reports (Phase 21) are the two modules that read across every other module without owning any of the underlying data — Reports formalizes what Dashboard's KPIs already compute (see `profitReport()` and `dashboard.repository.getKpis()`, which share the identical COGS formula).

## Deliberate spec deviations

Documented in full in each phase's [CHANGELOG.md](CHANGELOG.md) entry; summarized here:

- Gold/black brand palette over the spec's navy/green (approved during planning).
- Shared product catalog with per-branch inventory, not per-branch product duplication.
- Chart.js for Dashboard charts (not in the original approved library list).
- Camera-based QR scanning (`html5-qrcode`) rather than a physical barcode scanner.
- QR payload omits branch ID — products aren't branch-specific in this architecture; branch context comes from the scanning terminal's session.
- Reports export via Print (browser-native) + CSV (generic client-side, opens directly in Excel) rather than dedicated server-side PDF/Excel generation for all 12 report types.
- Notifications use fan-out-on-write (one row per recipient) rather than a shared NULL-`user_id` broadcast row, so read-state is always unambiguous.
- Database backups write to `backend/backups/` (outside the statically-served `backend/uploads/`) — a security-driven deviation from the original scaffold, since a full DB dump must never be reachable at a public URL.
