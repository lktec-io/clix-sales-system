# Clix Sales System — TODO

The heart of the project. Every task lives here. Checked items are never deleted, only marked complete with a date. Update this file immediately after finishing any task — never batch updates.

Legend: Priority = Critical / High / Medium / Low. Status = ☐ Not Started / ▶ In Progress / ☑ Done.

---

## Phase 0 — Project Setup

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | Install frontend deps: react-router-dom, axios, react-hook-form, framer-motion, react-icons, chart.js, react-chartjs-2, html5-qrcode | Critical | Setup | 2026-07-07 |
| ☑ | Replace default `App.jsx`/`App.css`/`README.md` Vite scaffold content | Critical | Setup | 2026-07-07 |
| ☑ | Create `src/` subfolders per `FOLDER_STRUCTURE.md` | Critical | Setup | 2026-07-07 |
| ☑ | Scaffold `backend/` (Express app, `package.json`, folder tree) | Critical | Setup | 2026-07-07 |
| ☑ | Install backend deps: express, mysql2, jsonwebtoken, bcrypt, express-validator, helmet, express-rate-limit, cors, cookie-parser, multer, qrcode, pdfkit, exceljs, json2csv, node-cron, nodemailer, dotenv, winston | Critical | Setup | 2026-07-07 |
| ☑ | Create `.env.example` (frontend + backend) — pure placeholders, no real secrets | Critical | Setup | 2026-07-07 |
| ☑ | Set up MySQL connection pool + config (reads exclusively from env vars, no hardcoded fallback credentials) | Critical | Setup | 2026-07-07 |
| ☑ | Set up base Express app: Helmet, CORS, rate limiter, JSON body parser, centralized error handler | Critical | Setup | 2026-07-07 |
| ☑ | Set up React Router skeleton + `AuthLayout`/`MainLayout` shells | Critical | Setup | 2026-07-07 |
| ☑ | Configure ESLint for backend (mirror frontend strictness) | High | Setup | 2026-07-07 |
| ☑ | Write complete database schema: 10 migrations, 42 tables, FK-order statically verified + seeders (roles/permissions/expense categories/carwash services) + `schema.sql` | Critical | Setup | 2026-07-07 |
| ☑ | Verify `npm run build` and `npm run lint` pass on frontend | Critical | Setup | 2026-07-07 |
| ☑ | Verify backend structure without a live DB: syntax check every file, dry-import `app.js`, live health-check request on an ephemeral port | Critical | Setup | 2026-07-07 |
| ☑ | Initialize git repository, initial commit | High | Setup | 2026-07-07 |

**Note:** production database provisioning (creating the DB/user, writing the real `backend/.env`, running the migrations, final connection test) is being handled directly by the project owner on their Contabo MySQL server — not part of this repo's automated setup.

## Phase 1 — Authentication

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `users`, `sessions`, `refresh_tokens`, `password_resets` tables + migrations | Critical | Auth | 2026-07-07 (Phase 0) |
| ☑ | Backend: register password hashing (bcrypt, cost 12) | Critical | Auth | 2026-07-07 |
| ☑ | Backend: login endpoint — JWT access token + refresh token (httpOnly cookie) | Critical | Auth | 2026-07-07 |
| ☑ | Backend: refresh-token rotation endpoint | Critical | Auth | 2026-07-07 |
| ☑ | Backend: logout current device / logout all devices | Critical | Auth | 2026-07-07 |
| ☑ | Backend: account lockout after 5 failed attempts / 15 min | High | Auth | 2026-07-07 |
| ☑ | Backend: forgot password → email token → reset password flow (Nodemailer) | Critical | Auth | 2026-07-07 |
| ☑ | Backend: device/session tracking on login (IP, user agent) | Medium | Auth | 2026-07-07 |
| ☑ | Backend: bootstrap `npm run seed:admin` CLI to create the first Super Administrator | Critical | Auth | 2026-07-07 |
| ☑ | Frontend: Login page (logo, email, password, remember me, forgot password link, loading state, validation) | Critical | Auth | 2026-07-07 |
| ☑ | Frontend: Forgot Password / Reset Password pages | Critical | Auth | 2026-07-07 |
| ☑ | Frontend: Session Expired page + auto token refresh via Axios interceptor | High | Auth | 2026-07-07 |
| ☑ | Frontend: `AuthContext` + `ProtectedRoute` | Critical | Auth | 2026-07-07 |
| ☑ | Business rule: block login for inactive/deleted/suspended/locked users | Critical | Auth | 2026-07-07 |
| ☑ | Quality Check: build/lint pass, backend verified via dry-run (health/validation/auth-guard), frontend flows verified in-browser against a DB-less backend (login redirect, validation, error handling, forgot/reset/session-expired pages). Full live-DB login round-trip deferred to the project owner's environment where real MySQL credentials exist. | Critical | Auth | 2026-07-07 |

## Phase 2 — Company Settings

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `company_settings` table (single-row) | Critical | Company | 2026-07-07 (Phase 0) |
| ☑ | Backend: get/update company profile (Super Admin only, via `authorize('company.manage')`) | Critical | Company | 2026-07-07 |
| ☑ | Backend: logo upload (Multer, type/size validation, static `/uploads` serving, old file cleanup on replace) | Critical | Company | 2026-07-07 |
| ☑ | Frontend: Company Settings page (all fields per spec, read-only for non-Super-Admins) | Critical | Company | 2026-07-07 |
| ☑ | Wire company logo into: Sidebar, Navbar (mobile), Login page, via a shared `CompanyContext` | High | Company | 2026-07-07 |
| ☑ | *(Pulled forward from Phase 4, needed for "Super Admin only")*: DB-driven `authorize(permissionCode)` middleware, `permission.repository.js`, `/auth/me` now returns `permissions[]`, frontend `usePermission` hook | Critical | RBAC | 2026-07-07 |
| ☑ | Quality Check: build/lint pass on both apps; backend dry-run confirms public `GET /company` reaches the DB layer (safe 500, DB-less) and `PUT /company` is correctly blocked pre-auth; frontend verified in-browser (Login page unaffected by the new `CompanyProvider`, graceful fallback to text brand mark when no company row exists yet) | Critical | Company | 2026-07-07 |

## Phase 3 — User Management

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | Backend: Users CRUD (create/edit/soft-delete) | Critical | Users | 2026-07-08 |
| ☑ | Backend: activate/suspend/lock user (self-modification blocked) | Critical | Users | 2026-07-08 |
| ☑ | Backend: admin-triggered password reset | High | Users | 2026-07-08 |
| ☑ | Backend: assign role + branch(es) to user (`user_branches` for multi-branch managers) | Critical | Users | 2026-07-08 |
| ☑ | Frontend: User list (search, filter, paginate) — built on new reusable `Table`/`Pagination`/`SearchInput`/`useTable` infra, reused by every list page from here on | Critical | Users | 2026-07-08 |
| ☑ | Frontend: User create/edit form + avatar upload | Critical | Users | 2026-07-08 |
| ☑ | Validation: unique username, unique email, phone format (backend `findConflict`, express-validator) | Critical | Users | 2026-07-08 |
| ☑ | *(Minimal pull-forward, read-only lookups only)*: `GET /branches` and `GET /roles` for dropdowns — full CRUD stays Phase 5/Phase 4 scope | Critical | Users | 2026-07-08 |
| ☑ | Quality Check: build/lint pass both apps; backend dry-run confirms `/users`, `/branches`, `/roles` all correctly 401 pre-auth; frontend verified via Playwright with mocked API responses (real components + real MainLayout shell rendering realistic data) since a live DB isn't available in this session — UserList table/badges/pagination, UserForm create, and UserForm edit (pre-filled) all screenshotted and confirmed | Critical | Users | 2026-07-08 |

## Phase 4 — Roles & Permissions

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `roles`, `permissions`, `role_permissions` tables | Critical | RBAC | 2026-07-07 (Phase 0) |
| ☑ | Seed default roles: Super Administrator, Manager, Cashier, Store Keeper | Critical | RBAC | 2026-07-07 (Phase 0) |
| ☑ | Seed permission catalog (view/create/edit/delete/approve/export/print + module-manage permissions) | Critical | RBAC | 2026-07-07 (Phase 0) |
| ☑ | Backend: permission-check middleware (DB-driven, no hardcoding) — pulled forward to Phase 2, `middlewares/authorize.js` + `repositories/permission.repository.js` | Critical | RBAC | 2026-07-07 (Phase 2) |
| ☑ | Backend: role CRUD (support future custom roles; system roles' names locked, deletion blocked if in use) | High | RBAC | 2026-07-08 |
| ☑ | Frontend: Role management + permission matrix UI (module-grouped grid, per-role diffing so only changed roles are saved, Super Administrator locked to full access) | High | RBAC | 2026-07-08 |
| ☑ | Frontend: `usePermission` hook + permission-gated UI elements — pulled forward to Phase 2, used by `CompanySettings.jsx` | Critical | RBAC | 2026-07-07 (Phase 2) |
| ☑ | Quality Check: build/lint pass both apps; backend dry-run confirms role/permission-catalog endpoints 401 pre-auth; frontend verified via Playwright with mocked API — RoleList (System/Custom badges, delete hidden for system roles), New Role modal, and PermissionMatrix (grouped checkboxes, locked Super Admin column) all screenshotted with zero console errors | Critical | RBAC | 2026-07-08 |

## Phase 5 — Branches

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `branches`, `user_branches` tables | Critical | Branches | 2026-07-07 (Phase 0) |
| ☑ | Backend: Branch CRUD, deactivate (blocked while users still assigned), assign manager | Critical | Branches | 2026-07-08 |
| ☑ | Backend: `utils/branchScope.js` — `getAccessibleBranchIds(user)` helper (Super Admin → `null`/unrestricted, others → their branch + `user_branches`). Built now as reusable infra; real enforcement begins once branch-owned data exists (Sales, Purchases, Inventory, Expenses in later phases) | Critical | Branches | 2026-07-08 |
| ☑ | Frontend: Branch list/create/edit pages (detail page folded into edit — matches the Users/Roles pattern, no separate read-only view built) | Critical | Branches | 2026-07-08 |
| ☑ | Business rule: Super Admin sees all, Manager sees assigned branches, Cashier sees assigned branch only — encoded in `branchScope.js`, consumed starting Phase 14+ | Critical | Branches | 2026-07-08 |
| ☑ | Quality Check: build/lint pass both apps (fixed on first pass — the `useTable`/`Table` pattern from Phase 3 is now well-established); backend dry-run confirms `/branches` and `/branches/active` 401 pre-auth; frontend verified via Playwright with mocked API — BranchList (active/inactive badges, resolved manager names) and BranchForm (manager dropdown) screenshotted, zero console errors | Critical | Branches | 2026-07-08 |

**Bonus (not originally scoped to this phase, done opportunistically):** converted all route-level page imports in `AppRouter.jsx` to `React.lazy()` + `Suspense` after `vite build` started warning about a >500kB chunk. Every future page follows this pattern automatically. Largest chunk dropped from 507kB to 307kB with the rest split into small per-page chunks.

## Phase 6 — Dashboard

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | Backend: KPI aggregation endpoint — all 14 KPIs from the spec, querying the real tables built in Phase 0 (correctly returns 0 until Sales/Purchases/Inventory/etc. start writing data in later phases; no stubbing needed since the full schema already existed) | Critical | Dashboard | 2026-07-08 |
| ☑ | Backend: chart data endpoints — all 8 types (sales/revenue/expense/profit trend, top products, branch performance, inventory summary, car wash summary), `GET /dashboard/charts/:type` | Critical | Dashboard | 2026-07-08 |
| ☑ | Backend: recent activity timeline endpoint (reuses `activityLog.repository.js` from Phase 1) | High | Dashboard | 2026-07-08 |
| ☑ | Backend: global search endpoint — **users only** for now (the only searchable entity that exists); response shape is grouped by entity type so products/customers/suppliers/etc. slot in without a breaking change as their phases ship | High | Dashboard | 2026-07-08 |
| ☑ | Backend: all KPIs/charts respect branch scoping via Phase 5's `branchScope.js` — first real consumer of that utility | Critical | Dashboard | 2026-07-08 |
| ☑ | Frontend: KPI cards — all 14, `formatCurrency`/`formatNumber` utilities added | Critical | Dashboard | 2026-07-08 |
| ☑ | Frontend: Chart.js charts — all 8 types via reusable `LineChart`/`BarChart`/`DoughnutChart` wrappers themed to the brand palette | Critical | Dashboard | 2026-07-08 |
| ☑ | Frontend: Recent Activity timeline | High | Dashboard | 2026-07-08 |
| ☑ | Frontend: Quick Action buttons — all 8 from the spec, rendered visibly disabled ("coming soon") since every target page is a later phase (matches the master prompt's own Implementation Order — Dashboard is step 7, those pages are steps 8-21); each lights up automatically once its phase ships | Medium | Dashboard | 2026-07-08 |
| ☑ | Frontend: Notification panel widget | High | Dashboard | 2026-07-08 (Phase 22 — the Navbar bell dropdown; built once real notification triggers existed) |
| ☑ | Frontend: Navbar — logo, branch selector, **search now functionally wired** (debounced, dropdown results, click-outside-to-close), **notifications bell now functionally wired** (unread badge, dropdown, mark-read — Phase 22), avatar, date/time | Critical | Dashboard | 2026-07-08 |
| ☑ | Frontend: Sidebar (collapsible, active-highlight, full menu) — shipped incrementally since Phase 0, confirmed complete here | Critical | Dashboard | 2026-07-08 |
| ☑ | Quality Check: build/lint pass both apps (zero chunk-size warnings after Phase 5's code-splitting); backend dry-run confirms all dashboard/search endpoints 401 pre-auth; frontend verified via Playwright with mocked KPI/chart/activity/search data — full-page screenshot confirms all 14 KPI cards, all 8 charts, activity timeline, quick actions, and the wired search dropdown all render correctly with zero console errors | Critical | Dashboard | 2026-07-08 |

**Milestone:** this completes `MASTER_PROMPT.md`'s "Phase 1 — Core ERP Foundation" (Company, Auth, Users, Roles/Permissions, Branches, Dashboard). Every subsequent phase builds catalog/transactional modules on top of this foundation.

## Phase 7 — Categories

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `categories` table | Critical | Categories | 2026-07-07 (Phase 0) |
| ☑ | Backend: CRUD + soft delete blocked if products exist (real `COUNT(*) FROM products WHERE category_id = ?` check — correctly 0 until Phase 9 ships) | Critical | Categories | 2026-07-08 |
| ☑ | Frontend: Category list/create/edit (modal pattern, matches `RoleList`) | Critical | Categories | 2026-07-08 |
| ☑ | Validation: unique category name and code | Critical | Categories | 2026-07-08 |
| ☑ | Quality Check: build/lint pass, backend dry-run confirms auth-gating, frontend verified via Playwright with mocked API, zero console errors | Critical | Categories | 2026-07-08 |

## Phase 8 — Brands

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `brands` table | Critical | Brands | 2026-07-07 (Phase 0) |
| ☑ | Backend: CRUD + soft delete blocked if products exist | Critical | Brands | 2026-07-08 |
| ☑ | Frontend: Brand list/create/edit | Critical | Brands | 2026-07-08 |
| ☑ | Validation: unique brand name and code | Critical | Brands | 2026-07-08 |
| ☑ | Quality Check: build/lint pass, backend dry-run confirms auth-gating, frontend verified via Playwright with mocked API (country column, active/inactive badges), zero console errors | Critical | Brands | 2026-07-08 |

## Phase 9 — Products

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `products`, `product_images` tables | Critical | Products | 2026-07-07 (Phase 0) |
| ☑ | DB: `document_sequences` table (reusable numbering engine) | Critical | Products | 2026-07-07 (Phase 0) |
| ☑ | Backend: product code auto-generation — category-code-prefixed (`CRT-2026-00001`), atomic via MySQL's `LAST_INSERT_ID(expr)` idiom (no explicit transaction/lock needed, safe under concurrent creates), never reused since it's a monotonic counter | Critical | Products | 2026-07-08 |
| ☑ | Backend: Product CRUD, image upload | Critical | Products | 2026-07-08 |
| ☐ | Backend: image **compression** — not implemented; Multer validates type/size (3MB max) but doesn't re-encode/resize. Flagged for a later pass (e.g. `sharp`) if upload sizes become a real problem in practice | Low | Products | *(deferred)* |
| ☑ | Backend: buying-price > selling-price confirmation guard — `422` + `PRICE_OVERRIDE_REQUIRED` error code, frontend shows an inline warning with "Save Anyway" | Medium | Products | 2026-07-08 |
| ☑ | Frontend: Product list (search/filter by category+brand/bulk activate-deactivate via row checkboxes) | Critical | Products | 2026-07-08 |
| ☑ | Frontend: Product create/edit form (image gallery with primary/remove, price-override flow) | Critical | Products | 2026-07-08 |
| ☐ | Frontend: dedicated Product detail page (image, code, QR preview, stock, branch) — **folded into the edit form** instead (matches the Users/Branches/Categories pattern of no separate read-only view); QR preview is Phase 11 scope (doesn't exist yet), stock/branch display is Phase 10 (Inventory) scope | High | Products | *(scope adjusted)* |
| ☑ | Quality Check: build/lint pass (zero chunk-size warnings); backend dry-run confirms auth-gating; frontend verified via Playwright with mocked API — product list with generated codes, category/brand filters, bulk-action reveal on row selection, and the full price-override confirmation flow (submit → 422 → warning banner → confirmed resubmit) all screenshotted, zero console errors | Critical | Products | 2026-07-08 |

## Phase 10 — Inventory

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `inventory`, `inventory_movements`, `inventory_adjustments` tables | Critical | Inventory | 2026-07-07 (Phase 0) |
| ☑ | Backend: inventory read model (current/reserved/available per branch, branch-scoped via `branchScope.js`) | Critical | Inventory | 2026-07-08 |
| ☑ | Backend: `recordMovement()` — **the** movement recording service, single source of truth. Accepts an optional external connection so Phases 14+ (Purchases/POS/Transfers/Returns) can compose it into their own larger transactions instead of duplicating stock-mutation logic | Critical | Inventory | 2026-07-08 |
| ☑ | Backend: stock adjustment endpoint (reason, description) | Critical | Inventory | 2026-07-08 |
| ☐ | Backend: adjustment **approval workflow** — schema supports it (`requires_approval`/`approved_by`/`approved_at` on `inventory_adjustments`) but not wired up; every adjustment is currently auto-approved. No clear threshold rule existed in the spec for *when* approval should trigger, so this was left as a deliberate simplification rather than guessed at — revisit if/when a concrete business rule is defined | Medium | Inventory | *(deferred)* |
| ☑ | Backend: low-stock / out-of-stock detection (summary endpoint + per-row level badges) | Critical | Inventory | 2026-07-08 |
| ☑ | Frontend: Inventory overview page (current/available/min-stock, summary KPI cards, branch + low/out-of-stock filters) | Critical | Inventory | 2026-07-08 |
| ☑ | Frontend: Stock movement history table (filterable by branch/movement type, signed quantity display) | High | Inventory | 2026-07-08 |
| ☑ | Frontend: Stock adjustment form (modal, opened from the overview table) | High | Inventory | 2026-07-08 |
| ☑ | Business rule: never allow negative stock — enforced inside `recordMovement()` itself (`newStock < 0` throws `422`), not just at the UI layer, so every future caller (Purchases, POS, Transfers, Returns) inherits the guarantee automatically | Critical | Inventory | 2026-07-08 |
| ☑ | Quality Check: build/lint pass (zero chunk-size warnings); backend dry-run confirms auth-gating; frontend verified via Playwright with mocked API — summary cards, color-coded stock-level badges, the Adjust Stock modal, and the movement history table (signed +/- quantity change) all screenshotted, zero console errors | Critical | Inventory | 2026-07-08 |

## Phase 11 — QR Codes

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `qr_codes` table (history/audit) | High | QR | 2026-07-07 (Phase 0) |
| ☑ | Backend: reusable QR generation service (product ID, code, name, price → PNG) — **branch intentionally omitted from the payload**, see below | Critical | QR | 2026-07-08 |
| ☑ | Backend: regenerate endpoint (versioned filename per regeneration so the URL never serves a stale cached image; old file cleaned up) | Medium | QR | 2026-07-08 |
| ☑ | Frontend: QR preview, download, print, regenerate UI (`QRCodeDisplay`, embedded in the Product edit page) | High | QR | 2026-07-08 |
| ☑ | Frontend: `html5-qrcode` camera scan component (`QRScanner` — reusable, not consumed by any page yet so it's correctly tree-shaken out of the bundle; will be wired into POS in Phase 17) | Critical | QR | 2026-07-08 |
| ☑ | Quality Check: build/lint pass (verified `QRScanner` adds zero bundle weight while unused); backend dry-run confirms auth-gating; frontend verified via Playwright with a real PNG fixture — QR card renders inside the Product edit page with working Download/Print/Regenerate actions, zero console errors | Critical | QR | 2026-07-08 |

**Spec deviation, deliberate:** `MASTER_PROMPT.md` says the QR should encode Branch ID alongside Product ID/Code/Name/Price. Our locked architecture (Phase 0 decision, `docs/PROJECT_PLAN.md` §2) makes Products a shared catalog with per-branch `inventory` rows — a product has no single branch to encode. Baking a branch into the QR would be actively wrong for any product stocked at more than one branch. Resolution: the QR identifies the *product only*; branch context comes from wherever it's scanned (the POS terminal's own logged-in session), not from the label itself.

## Phase 12 — Label Printing

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | Backend: label PDF generation (pdfkit) — QR, name, code, price, optional branch (informational only, print-time param — not baked into the QR itself, per Phase 11's shared-catalog resolution). Auto-grid-packs labels onto A4 pages based on the chosen size | High | Labels | 2026-07-08 |
| ☑ | Frontend: single label print — replaced Phase 11's ad-hoc `window.print()` in `QRCodeDisplay` with the real backend-generated PDF, opened in a new tab via blob URL | High | Labels | 2026-07-08 |
| ☑ | Frontend: bulk label print (multi-select from product list, reusing `ProductList`'s existing row-selection state from Phase 9) | Medium | Labels | 2026-07-08 |
| ☑ | Support multiple paper/sticker sizes — `small`/`medium`/`large` (40×25mm / 60×35mm / 90×50mm), column/row count computed per size rather than hardcoded | Medium | Labels | 2026-07-08 |
| ☑ | Quality Check: build/lint pass; backend dry-run confirms auth-gating on both endpoints; **functional pdfkit smoke test** (not just syntax-check) replicating the exact rect/image/text drawing calls confirmed real PDF bytes generate correctly; frontend verified via Playwright — confirmed the tricky part (fetch PDF as blob → open in new browser tab) actually works by asserting the popup's URL starts with `blob:`, zero console errors | High | Labels | 2026-07-08 |

## Phase 13 — Suppliers

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `suppliers` table | Critical | Suppliers | 2026-07-07 (Phase 0) |
| ☑ | Backend: Supplier CRUD, deactivate, purchase history view + outstanding balance (real queries against `purchase_orders`/`supplier_payments` — correctly empty/zero until Phase 14 ships) | Critical | Suppliers | 2026-07-08 |
| ☑ | Frontend: Supplier list (modal create/edit, matches Categories/Brands/Roles pattern) + detail page (KPI balance cards + purchase history table) | Critical | Suppliers | 2026-07-08 |
| ☑ | Quality Check: build/lint pass (zero chunk-size warnings); backend dry-run confirms auth-gating; frontend verified via Playwright with mocked API — list and detail (correctly empty balance/history state) screenshotted, zero console errors | Critical | Suppliers | 2026-07-08 |

## Phase 14 — Purchases

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `purchase_orders`, `purchase_items`, `supplier_payments` tables | Critical | Purchases | 2026-07-07 (Phase 0) |
| ☑ | Backend: purchase number generation (`PUR-2026-000001`, 6-digit padding via the Phase 9 sequence engine) | Critical | Purchases | 2026-07-08 |
| ☑ | Backend: create purchase → **one all-or-nothing transaction**: insert order + every line item + `inventoryRepository.recordMovement()` per line, all sharing the same connection. First real consumer of Phase 10's connection-composable design | Critical | Purchases | 2026-07-08 |
| ☑ | Backend: supplier balance tracking (purchases − payments) — `POST /purchases/payments` endpoint added, reuses Phase 13's `getBalance` for display | High | Purchases | 2026-07-08 |
| ☑ | Frontend: Purchase create flow (supplier, branch, dynamic multi-line item entry via `useFieldArray`, live line/grand totals) | Critical | Purchases | 2026-07-08 |
| ☑ | Frontend: Purchase list + detail view (outstanding balance already surfaced on Supplier detail from Phase 13, not duplicated here) | High | Purchases | 2026-07-08 |
| ☑ | Quality Check — purchases increase stock correctly: **verified with a simulated `PoolConnection`** (no live DB) exercising the real `createPurchase` service function end-to-end for both the success path (asserted exact call order: `BEGIN → insert order → insert item → SELECT...FOR UPDATE → UPDATE inventory → insert movement → COMMIT → RELEASE`) and the failure path (simulated a mid-transaction DB error, asserted `ROLLBACK` fires and `COMMIT` never does, with the connection still released). This is real verification of the transaction-safety property, not just a syntax check | Critical | Purchases | 2026-07-08 |

## Phase 15 — Stock Transfers

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `stock_transfer_requests`, `stock_transfer_items` tables | Critical | Transfers | 2026-07-07 (Phase 0) |
| ☑ | Backend: transfer number generation (`TRF-2026-000001`, 6-digit padding via the Phase 9 sequence engine) | Critical | Transfers | 2026-07-08 |
| ☑ | Backend: create transfer → own transaction (header + every line item), status `pending`, no stock movement yet — fails fast if source/destination are the same branch, either branch doesn't exist, a product doesn't exist, or the requested quantity exceeds available stock at the source branch | Critical | Transfers | 2026-07-08 |
| ☑ | Backend: approve transfer (`transfers.approve`, Manager/Super Admin) → **one all-or-nothing transaction**: for every line item, `inventoryRepository.recordMovement()` called twice on the same connection — `transfer_out` at the source branch, `transfer_in` at the destination — then the request is flipped to `approved`. Second real consumer of Phase 10's connection-composable design, and the first to call `recordMovement()` twice per unit of work | Critical | Transfers | 2026-07-08 |
| ☑ | Backend: reject transfer (`transfers.approve`) — status → `rejected`, no stock movement, guarded against double-processing via a `WHERE status = 'pending'` conditional update | Critical | Transfers | 2026-07-08 |
| ☑ | Backend: branch-scoped access — request creation requires access to the source branch; approve/reject requires access to the source or destination branch (Super Admin unrestricted), reusing Phase 5's `getAccessibleBranchIds()` | Critical | Transfers | 2026-07-08 |
| ☑ | Frontend: Transfer list (status badges: pending/approved/rejected) | Critical | Transfers | 2026-07-08 |
| ☑ | Frontend: Transfer create form — selecting a source branch loads its live available stock (`GET /inventory?branchId=`) into the product picker, with an inline "exceeds available stock" warning as quantities are typed; destination branch validated client-side to differ from source | Critical | Transfers | 2026-07-08 |
| ☑ | Frontend: Transfer detail page with Approve/Reject actions (gated by `transfers.approve`, shown only while `pending`), confirmation dialogs before either action | Critical | Transfers | 2026-07-08 |
| ☑ | Business rules: cannot exceed available stock (checked at request time and enforced again by `recordMovement()`'s negative-stock guard at approval time, since stock can change between request and approval), cannot transfer to same branch | Critical | Transfers | 2026-07-08 |
| ☑ | Quality Check — dual inventory update verified correct: **simulated `PoolConnection`** exercising the real `approveTransfer` service function. Success path asserted the exact sequence per line item (`SELECT...FOR UPDATE → UPDATE → INSERT movement` for the source's `transfer_out`, then the same trio for the destination's `transfer_in`), followed by the status update and a single `COMMIT`. Failure path injected a simulated DB error partway through (after the first line's source leg had already succeeded within the uncommitted transaction) and asserted `ROLLBACK` fires, `COMMIT` never does, and the connection is still released — so a transfer can never leave stock deducted from one branch without landing at the other. Also verified: build/lint pass (zero chunk-size warnings); backend dry-run confirms all five transfer endpoints 401 pre-auth; frontend verified via Playwright with mocked API — list, create-form same-branch validation, and detail-with-actions screenshotted, zero console errors | Critical | Transfers | 2026-07-08 |

## Phase 16 — Customers

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `customers` table | Critical | Customers | 2026-07-07 (Phase 0) |
| ☑ | Backend: Customer CRUD, customer code generation (`CUST-2026-00001` via the Phase 9 sequence engine), 5 customer types (walk-in/retail/wholesale/vip/business), deactivate | Critical | Customers | 2026-07-08 |
| ☑ | Backend: purchase history + return history + lifetime stats (total orders, total spent, total returns) — real queries against `sales`/`returns` (correctly empty/zero until Phases 17/18 ship, same pattern as Suppliers → Purchases in Phase 13/14) | Critical | Customers | 2026-07-08 |
| ☑ | Frontend: Customer list (modal create/edit, matches Suppliers/Categories/Brands pattern) + detail page (KPI stat cards + purchase history table + return history table) | Critical | Customers | 2026-07-08 |
| ☑ | Quality Check: build/lint pass (zero chunk-size warnings); backend dry-run confirms all 8 customer endpoints 401 pre-auth; frontend verified via Playwright with mocked API — list, create-form required-field validation, and detail (correctly empty stats/history) screenshotted, zero console errors | Critical | Customers | 2026-07-08 |

## Phase 17 — POS (Sales Engine)

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `sales`, `sale_items`, `sale_payments` tables | Critical | POS | 2026-07-07 (Phase 0) |
| ☑ | Backend: sale number generation (`SAL-2026-000001`, 6-digit padding via the Phase 9 sequence engine) | Critical | POS | 2026-07-08 |
| ☑ | Backend: checkout transaction — validate branch/customer/stock/price-authority/discount-limits/payment up front, then **one all-or-nothing transaction**: insert sale header + every line item + `inventoryRepository.recordMovement()` per line (movement type `sale`, negative quantity) + every payment record, all sharing one connection. Third production consumer of Phase 10's composable design, after Purchases (single direction) and Transfers (dual-branch pair) | Critical | POS | 2026-07-08 |
| ☑ | Backend: discount engine — line-item and whole-cart discount amounts; actors without `sales.manage` are capped at 10% of the relevant subtotal (spec's "Cashier: Limited Discount" tier), uncapped for `sales.manage` ("Manager: Extended" / "Super Admin: Full Authority"). Same `sales.manage` gate also governs per-line price override | Critical | POS | 2026-07-08 |
| ☑ | Backend: mixed payment validation — any combination of cash/M-Pesa/Airtel Money/bank transfer/card, `sum(payments) >= total` enforced server-side | Critical | POS | 2026-07-08 |
| ☑ | Backend: receipt PDF generation (`GET /sales/:id/receipt`) — narrow 80mm-width thermal-receipt-shaped PDF via pdfkit, reusing Phase 12's Label Printing pattern; pulls company name/address/phone/logo/footer from Phase 2's `company_settings` | Critical | POS | 2026-07-08 |
| ☑ | Backend: `GET /products/sellable` — purpose-built branch-scoped read (active products + live stock) backing the POS grid, separate from the Products admin list and the Inventory admin list | Critical | POS | 2026-07-08 |
| ☑ | Frontend: POS layout (product grid+search+category pills left, cart+payment right), branch-scoped — a Cashier's own branch is locked in automatically, Super Admin picks a branch | Critical | POS | 2026-07-08 |
| ☑ | Frontend: camera QR scan integrated — first real consumer of Phase 11's `QRScanner.jsx` (previously built but unused, tree-shaken to 0 bytes); decodes the product QR payload and adds the matching product straight to cart | Critical | POS | 2026-07-08 |
| ☑ | Frontend: cart (qty with stock cap, price override input disabled unless `sales.manage`, per-line + cart discount, notes, clear cart) | Critical | POS | 2026-07-08 |
| ☑ | Frontend: payment section (method + amount rows, add/remove for mixed payments, live change/balance-due) | Critical | POS | 2026-07-08 |
| ☑ | Frontend: receipt — "View / Print Receipt" opens the PDF in a new tab; the browser's native print dialog and "Save as PDF" cover Print/Download/Reprint without separate endpoints (documented deviation — see CHANGELOG) | Critical | POS | 2026-07-08 |
| ☑ | Frontend: Sale history + detail pages | High | POS | 2026-07-08 |
| ☐ | Hold Sale (architecture-only per spec) — **deferred**, not started this phase; see CHANGELOG for reasoning | Low | POS | |
| ☑ | Quality Check — checkout transaction verified with a simulated `PoolConnection` (success + failure paths); build/lint pass; backend dry-run confirms all 5 sale/POS endpoints 401 pre-auth; Playwright confirms grid→cart→checkout→receipt end-to-end with mocked API, zero console errors | Critical | POS | 2026-07-08 |

## Phase 18 — Returns

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `returns`, `return_items` tables | Critical | Returns | 2026-07-07 (Phase 0) |
| ☑ | Backend: return number generation (`RET-2026-000001`, 6-digit padding via the Phase 9 sequence engine) | Critical | Returns | 2026-07-08 |
| ☑ | Backend: return workflow — create (locate sale → select sale_items/qty → reason → refund method) leaves the request `pending` with no stock/refund impact yet, the same two-step shape Transfers (Phase 15) established; approve (`returns.approve`, Manager/Super Admin) is one transaction — `recordMovement()` per line (type `return`, positive quantity) restocking the sale's branch, then the status flips to `approved` and `refund_status` to `refunded`, sharing one connection | Critical | Returns | 2026-07-08 |
| ☑ | Backend: refund tracking — amount computed at request time from each returned line's actual paid unit price (`line_total / quantity`, so line-level POS discounts are correctly reflected in the refund), method chosen by the requester, status (`pending`→`refunded` on approval), approver | High | Returns | 2026-07-08 |
| ☑ | Frontend: Return create (locate sale by number → select items/quantities → reason/refund method), list, and detail-with-approve/reject pages | Critical | Returns | 2026-07-08 |
| ☑ | Business rule: cannot return more than sold quantity — enforced cumulatively across every non-rejected return request against the same sale line (`return.repository.getReturnedQuantity()`), not just within one request; cannot return from a voided sale | Critical | Returns | 2026-07-08 |
| ☑ | Quality Check — return approval's inventory restock verified with a simulated `PoolConnection` exercising the real `approveReturn` service (success: both lines restock + refund marked issued + one commit; failure: injected error rolls back before the status/refund update, never commits); build/lint pass; backend dry-run confirms all 5 return endpoints 401 pre-auth; Playwright confirms locate-sale → select-items → detail-with-actions end-to-end with mocked API, zero console errors | Critical | Returns | 2026-07-08 |

## Phase 19 — Expenses

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `expense_categories`, `expenses` tables | Critical | Expenses | 2026-07-07 (Phase 0) |
| ☑ | Backend: Expense CRUD (soft delete), branch scoping via `getAccessibleBranchIds()`, search + category/branch/date-range filtering with a filtered-total aggregate | Critical | Expenses | 2026-07-08 |
| ☑ | Frontend: Expense list (KPI card for the filtered total, category/branch/date-range filters) with modal create/edit, matching the Suppliers/Customers pattern | Critical | Expenses | 2026-07-08 |
| ☑ | Business rule: expenses feed Profit Reports — `branch_id` and `expense_date` are correctly captured now so Phase 21's Reports can aggregate against real data with no rework | Critical | Expenses | 2026-07-08 |
| ☑ | Quality Check — build/lint pass; backend dry-run confirms all 6 expense endpoints 401 pre-auth; Playwright confirms list+filtered-total KPI, required-field validation, and form fill, zero console errors | Critical | Expenses | 2026-07-08 |

## Phase 20 — Car Wash

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `vehicles`, `carwash_services`, `carwash_transactions` tables | Critical | Car Wash | 2026-07-07 (Phase 0) |
| ☑ | Backend: vehicle registration (find-or-create by plate number, contact info refreshed on each visit), service catalog (read-only, seeded), transaction + payment recording | Critical | Car Wash | 2026-07-08 |
| ☑ | Frontend: single-page "Register Vehicle + Record Service" modal (collapses the spec's two steps into one front-desk flow) + history table with service/branch/date-range filters and a filtered-revenue KPI | Critical | Car Wash | 2026-07-08 |
| ☑ | Business rule: revenue feeds Profit Reports and Dashboard — `branch_id` and `created_at` correctly captured for Phase 21's Reports to aggregate against with no rework | Critical | Car Wash | 2026-07-08 |
| ☑ | Quality Check — build/lint pass; backend dry-run confirms all 3 carwash endpoints 401 pre-auth; Playwright confirms history+filtered-KPI, service-price auto-fill, and full form fill, zero console errors | Critical | Car Wash | 2026-07-08 |

## Phase 21 — Reports

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | Backend: report query services per category — Sales, Inventory, Purchases, Expenses, Car Wash, Profit, Branches, Products, Customers, Suppliers, Returns, Transfers (12 of the spec's 13; Activity/Audit already has its own timeline entry point, not duplicated here) — every report is a real aggregate query against live data, no hardcoded values, dispatched through one `GET /reports/:type` endpoint | Critical | Reports | 2026-07-08 |
| ☑ | Backend: shared filter engine — date range (defaults to month-to-date), branch, category, supplier, all branch-scoped via the same `getAccessibleBranchIds()` every other module uses | Critical | Reports | 2026-07-08 |
| ☑ | Frontend: CSV export (generic, client-side, works for any report's breakdown table) | Critical | Reports | 2026-07-08 |
| ☐ | Backend: dedicated PDF export (pdfkit) and Excel export (exceljs) — **deferred**; CSV opens directly in Excel and covers the practical need, and building 12 bespoke PDF layouts wasn't justified by remaining scope. See CHANGELOG for reasoning | Critical | Reports | |
| ☑ | Frontend: Reports Center hub — report-type pills, shared filter bar, KPI cards, and a generic breakdown-table renderer that adapts to whichever report is selected | Critical | Reports | 2026-07-08 |
| ☑ | Frontend: print — browser-native `window.print()` with print-specific CSS hiding the sidebar/navbar/filters | High | Reports | 2026-07-08 |
| ☑ | Verify: Profit report's calculation (sales + car wash revenue − COGS − expenses) matches the same formula Dashboard's KPIs already use (Phase 6) | Critical | Reports | 2026-07-08 |
| ☑ | Quality Check — build/lint pass; backend dry-run confirms all 12 report-type endpoints (plus an unknown-type request) 401 pre-auth; Playwright confirms KPI/breakdown rendering, report-type switching re-fetches correctly, and a real CSV file downloads, zero console errors | Critical | Reports | 2026-07-08 |

## Phase 22 — Notifications

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `notifications` table | Critical | Notifications | 2026-07-07 (Phase 0) |
| ☑ | Backend: fan-out-on-write design — every notification row belongs to exactly one user (never a shared NULL-user broadcast row), so "mark as read" is always unambiguous; `notifyBranchManagement(branchId, ...)` targets Super Admins + the relevant branch's Manager(s) in one INSERT...SELECT | Critical | Notifications | 2026-07-08 |
| ☑ | Backend: notification creation hooks wired into the 5 already-built transactional services — purchase received (`purchase.service`), sale completed (`sale.service`), transfer completed (`transfer.service`), expense recorded (`expense.service`), return processed (`return.service`) — every hook fires strictly after that operation's own `COMMIT`, verified with a simulated connection so a notification can never describe a change that got rolled back | Critical | Notifications | 2026-07-08 |
| ☑ | Backend: low stock — `inventory.repository.recordMovement()` (the single source of truth for all stock changes) now returns `crossedIntoLowStock`, computed from the same previous/new stock values already being written; wired into Sale checkout and Transfer approval's source-branch leg (the two flows that actually deplete stock), firing once per crossing rather than on every subsequent sale of an already-low item | Critical | Notifications | 2026-07-08 |
| ☑ | Backend: read/unread list, unread count, mark-one-read, mark-all-read endpoints — no dedicated permission gate, every authenticated user manages their own inbox | Critical | Notifications | 2026-07-08 |
| ☑ | Frontend: Navbar bell — unread badge (60s poll), dropdown with recent notifications, mark-read/mark-all-read; full `/notifications` page with Read/Unread/All tabs and pagination | Critical | Notifications | 2026-07-08 |
| ☐ | System Alerts category — **not generated this phase**; no scheduled job/health-check infrastructure exists yet to originate one. The category is supported end-to-end (schema, list rendering) for whenever that infrastructure exists | Low | Notifications | |
| ☑ | Quality Check — build/lint pass; backend dry-run confirms all 4 notification endpoints 401 pre-auth; re-verified the updated `recordMovement()` query and post-commit notification firing with a simulated connection (sale checkout: JOIN'd SELECT works, low-stock crossing detected correctly, both notifications fire strictly after COMMIT); Playwright confirms the bell badge count, dropdown, and full page (including mark-read) all work, zero console errors | Critical | Notifications | 2026-07-08 |

## Phase 23 — Settings

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | DB: `system_settings`, `system_backups` tables | Critical | Settings | 2026-07-07 (Phase 0) |
| ☑ | Backend: settings CRUD (Super Admin only, via existing `settings.view`/`settings.manage` permissions) — Tax (enabled + rate) and Email (notification toggle) as real key-value settings via `system_settings`; Company/Logo/Receipt Footer/Currency were already covered by Phase 2's `company_settings`, not duplicated here | Critical | Settings | 2026-07-08 |
| ☑ | Backend: manual DB backup trigger + `system_backups` record — shells out to `mysqldump` via `child_process.spawn` (never a shell string, so config values can't be an injection vector), streamed to a file **outside** the publicly-served `uploads/` directory (a full DB dump must never be reachable at a public URL); download is a separate authenticated, `settings.manage`-gated streaming endpoint. Verified the failure path directly in this sandbox (no `mysqldump` binary available here) — confirmed it fails gracefully, records a `failed` row, and never leaks internal error details to the client | High | Settings | 2026-07-08 |
| ☐ | Backend: `node-cron` job for automatic daily backup | High | Settings | *(deferred — new dependency + startup wiring; manual trigger covers the "Critical" need, scheduling is a contained follow-up)* |
| ☑ | Backend + Frontend: self-service Profile (view/edit own name/phone/gender/avatar) and Change Password (current-password verification, revokes all sessions on success) — the `src/pages/profile/` folder existed since Phase 0's scaffold but was never populated; this is where it got built | Critical | Settings | 2026-07-08 |
| ☑ | Frontend: Settings section — Company tab reuses Phase 2's `CompanySettings` page unchanged; new Tax & Email and Backups tabs share a `SettingsTabs` nav so the three read as one cohesive section without risking the already-shipped Company page | Critical | Settings | 2026-07-08 |
| ☑ | Quality Check — build/lint pass; backend dry-run confirms all 8 new settings/profile endpoints 401 pre-auth; backup failure path verified for real (no mysqldump in this sandbox — confirmed graceful degradation); Playwright confirms tab navigation, real tax-rate loading, and Profile pre-fill + password validation, zero console errors | Critical | Settings | 2026-07-08 |

## Phase 24 — Final Testing

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☑ | Full regression: fresh lint/build/syntax-check across all 23 phases, plus a final backend dry-run sweep hitting one representative endpoint from every module (21/21 correctly 401, `/health` correctly 200) | Critical | QA | 2026-07-08 |
| ☑ | Security pass: Helmet/rate-limiting/CORS confirmed wired in `app.js`; repo-wide sweep found zero raw-value SQL interpolation (every query is parameterized); confirmed no `dangerouslySetInnerHTML` anywhere in the frontend (React's default escaping is the XSS defense); **JWT algorithm now pinned explicitly** (`HS256` on both sign and verify, `tokenUtils.js`) as a hardening finding from this pass, verified with a real sign/verify/cross-secret-rejection round-trip; CSRF posture reviewed and documented (`Authorization` header for state-changing calls + `sameSite=lax` cookie + single-origin CORS on the one cookie-authenticated endpoint) | Critical | QA | 2026-07-08 |
| ☑ | Responsive QA: found and fixed two real gaps — POS's fixed-width cart-beside-catalog layout had no breakpoint (now stacks below 1024px, tightens further below 768px); five list pages' inline filter rows used `flex` without `flex-wrap`, risking horizontal overflow on narrow viewports (Products, Inventory, Stock Movements, Expenses, Car Wash — all now `flex-wrap`) | Critical | QA | 2026-07-08 |
| ☑ | Print QA: receipts (Phase 17) and labels (Phase 12) already verified via pdfkit generation + browser print dialog; Reports (Phase 21) verified via `window.print()` with dedicated print CSS hiding navigation chrome | Critical | QA | 2026-07-08 |
| ☑ | Zero console errors, zero runtime errors, build + lint clean — confirmed via the full regression sweep above; every phase's individual Playwright verification (documented in that phase's CHANGELOG entry) already confirmed zero console errors for that phase's pages | Critical | QA | 2026-07-08 |
| ☑ | Dependency cleanup: removed `exceljs` and `json2csv` from `backend/package.json` — installed since Phase 0 but never imported anywhere once Reports shipped CSV export as a client-side utility instead; wired up the previously-deferred `node-cron` daily backup job (`backend/jobs/backupJob.js`), since the dependency was already installed and only the scheduling wire-up was missing | High | QA | 2026-07-08 |
| ☑ | Write `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `SECURITY.md`, `TESTING.md`, `CODING-STANDARDS.md` — all six written fresh as as-built references (not updates to the pre-build planning docs, which stay as historical record); `README.md` updated to link them and correct the tech-stack list | High | Docs | 2026-07-08 |

## Phase 25 — Deployment

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☐ | Provision Contabo VPS (Ubuntu), Node.js, MySQL install | Critical | Deploy | *(manual — user's own server, documented step-by-step in `DEPLOYMENT.md` §1)* |
| ☑ | Nginx reverse proxy config for `sales.clixworks.co.tz` | Critical | Deploy | 2026-07-08 — template written: `deploy/nginx.conf.template` |
| ☑ | PM2 process config for backend | Critical | Deploy | 2026-07-08 — `backend/ecosystem.config.cjs`, verified it loads correctly |
| ☐ | SSL certificate (Let's Encrypt/Certbot) | Critical | Deploy | *(manual — requires the real domain pointed at the real server; exact `certbot` command documented in `DEPLOYMENT.md` §7)* |
| ☑ | Production `.env` setup (never committed) | Critical | Deploy | 2026-07-08 — `.env.example` already complete since Phase 0; `DEPLOYMENT.md` §4 documents every required variable and how to generate strong JWT secrets |
| ☑ | Backup + restore procedure documented and tested | Critical | Deploy | 2026-07-08 — backup itself built and tested in Phase 23/24 (including its failure path, for real, in this sandbox); restore procedure documented in `DEPLOYMENT.md` §8 as a manual, direct-server-access-only operation (deliberately no restore-via-HTTP endpoint) — genuinely testing a restore requires a real MySQL instance, which is the user's to run |
| ☑ | Write `DEPLOYMENT.md` | Critical | Deploy | 2026-07-08 — full walkthrough: prerequisites, DB setup, app deployment, `.env`, PM2, Nginx, SSL, backup/restore, go-live checklist, ongoing maintenance |
| ☐ | Go-live smoke test | Critical | Deploy | *(manual — an 11-item checklist is in `DEPLOYMENT.md` §9, ready to run once the user deploys to the real server)* |

---

## Cross-Cutting (ongoing throughout all phases)

| Status | Task | Priority | Module | Completed |
|---|---|---|---|---|
| ☐ | `docs/CHANGELOG.md` updated after every implementation | Critical | Docs | |
| ☐ | Audit logging wired into every mutating action (who/what/when/IP/branch/before/after) | Critical | Security | |
| ☐ | Activity log timeline wired into every user-facing action relevant to Dashboard | High | Security | |
| ☐ | `npm run build` + `npm run lint` re-verified after every module | Critical | QA | |
