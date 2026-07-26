# Changelog

All notable changes to Clix Sales System are recorded here, newest first.

## Phase 25 — Deployment Preparation

**The final phase.** Everything in this phase is preparation, not execution — provisioning the actual Contabo VPS, pointing the real domain at it, and obtaining a real SSL certificate are the user's own actions against infrastructure this build never had access to (by design, per the constraint that governed the entire project: "I will handle the real Contabo MySQL credentials and production `.env`"). What *is* done: every config file and every documented step needed for that deployment to be routine rather than improvised.

**New files**
- `backend/ecosystem.config.cjs`: PM2 process definition for the backend API — single-instance fork mode (the right default for this VPS scale; cluster-mode tradeoffs are noted in `DEPLOYMENT.md` for later), auto-restart with a memory ceiling, log files under `backend/logs/`. Verified it loads correctly and resolves `__dirname` as expected.
- `deploy/nginx.conf.template`: reverse-proxy config serving the frontend's `dist/` build as static files, proxying `/api/` and `/uploads/` to the PM2-managed backend on port 4000. Deliberately does **not** expose `backend/backups/` — consistent with the security reasoning from Phase 23/24 that a full database dump must never be reachable at a public URL.
- `docs/DEPLOYMENT.md`: the complete walkthrough — server prerequisites, database setup (including applying `schema.sql` and the two seeders, and creating the first Super Admin via the existing `npm run seed:admin` script), application deployment, the full list of required `.env` variables with guidance on generating strong JWT secrets, starting the backend with PM2, wiring up Nginx, obtaining SSL via Certbot, the backup/restore procedure (restore is deliberately a manual, direct-server-access-only operation — never an HTTP endpoint, for the same reason there's no way to trigger it remotely), an 11-item go-live smoke test checklist, and ongoing maintenance notes.

**Documentation accuracy pass**
- Verified every command referenced in `DEPLOYMENT.md` against the actual codebase rather than writing from assumption — confirmed `npm run seed:admin` behaves exactly as documented (interactive or env-var-driven, no hardcoded credentials), confirmed the PM2 config loads and resolves paths correctly, confirmed `.env.example` (complete since Phase 0) covers every variable `DEPLOYMENT.md` tells the operator to set.

## Phase 24 — Final Testing

**The QA pass across all 23 feature phases** — no new features, but real findings and real fixes, not a rubber stamp.

**Security pass**
- Confirmed Helmet, CORS (locked to a single configured origin with credentials), and rate limiting (300/15min general, 10/15min on auth endpoints) are all correctly wired in `app.js`.
- Repo-wide sweep for SQL injection: zero matches for raw-value string interpolation in any SQL template literal across every repository file — every query is parameterized, confirmed rather than assumed.
- Confirmed zero uses of `dangerouslySetInnerHTML` anywhere in the frontend — React's default JSX escaping is the XSS defense for this SPA, and nothing bypasses it.
- **Real finding, real fix**: JWT signing/verification relied on `jsonwebtoken`'s default algorithm rather than pinning one explicitly. Hardened both `signAccessToken`/`signRefreshToken` and `verifyAccessToken`/`verifyRefreshToken` (`backend/utils/tokenUtils.js`) to `HS256` explicitly — defense in depth against algorithm-confusion attacks. Verified with a real sign → verify round-trip plus a cross-secret rejection test (an access-secret-signed token correctly fails verification against the refresh secret).
- Documented the CSRF posture in the new `SECURITY.md`: the `Authorization` header (not a cookie) carries the access token for every state-changing call, and the one cookie-authenticated endpoint (`/auth/refresh`) is protected by `sameSite=lax` plus the strict single-origin CORS policy.

**Responsive QA — two real gaps found and fixed**
- POS's `.pos-page` layout (fixed-width cart beside a flexible catalog) had no responsive breakpoint at all — below tablet-landscape width it would have overflowed horizontally. Added breakpoints: stacks vertically below 1024px (each panel independently height-bounded and scrollable), tightens further below 768px (toolbar stacks, product grid tiles shrink).
- Five list pages' inline filter rows (Products, Inventory, Stock Movements, Expenses, Car Wash) used a bare `flex` container for 3-4 filter selects/date inputs with no wrap — on a narrow viewport these would overflow rather than wrap onto a new line, unlike the outer `.table-toolbar` (which already had `flex-wrap`). Added the existing `.flex-wrap` utility class to all five.

**Dependency cleanup**
- Removed `exceljs` and `json2csv` from `backend/package.json` — both installed since Phase 0's initial scaffold in anticipation of Reports' export feature, but never imported anywhere once Phase 21 shipped CSV export as a generic client-side utility instead (a deliberate, documented choice at the time). Confirmed zero references before removing.
- Closed the `node-cron` deferral from Phase 23: the dependency was already installed, so wiring up the daily scheduled backup (`backend/jobs/backupJob.js`, registered in `server.js` after the HTTP server starts listening) was a small, contained addition. `backup.service.createBackup()` now takes a `triggerType` parameter (`'manual'` default for the HTTP-triggered path, `'scheduled'` for the cron job) so Settings → Backups can distinguish the two in its history table.

**Documentation**
- Wrote six new as-built reference docs from scratch: `ARCHITECTURE.md` (layering, the four core reusable patterns — `recordMovement`, `generateCode`, `branchScope`, permission caching — transaction safety, module dependency graph), `DATABASE.md` (all 42 tables by domain, conventions, the inventory ledger design, two-step approval workflow shape), `API.md` (every endpoint across all 22 route groups with its permission requirement), `SECURITY.md` (everything in this phase's security pass, plus honest known-limitations for production hardening), `TESTING.md` (the verification methodology used throughout — static checks, dry-run auth-gating, the simulated-`PoolConnection` transaction verification technique, Playwright — since no automated test suite or live database existed during this build), `CODING-STANDARDS.md` (the conventions every phase actually followed, for whoever touches this code next). `README.md` updated to link all six and correct a tech-stack list that had drifted from what's actually installed.

**Verification**
- Full regression: fresh `npm run lint` + `npm run build` (frontend) and `npm run lint` + a syntax-check sweep of every backend file, both clean.
- A final backend dry-run hit one representative endpoint from all 21 protected route groups plus `/health` — 21/21 correctly return 401 pre-auth, `/health` correctly returns 200.
- The JWT hardening was verified with a genuine sign/verify/cross-secret-rejection test, not just a syntax check.

## Phase 23 — Settings

**The last new-feature phase** — everything after this is testing and deployment prep. Deliberately scoped to *only* what Phase 2 (Company Settings) didn't already cover, plus two genuinely-missing pieces the whole system needed: a self-service Profile/Password flow, and a real (not decorative) database backup trigger.

**System Settings (Tax & Email)**
- `system_settings` is a key-value table; `systemSettings.service` wraps it with a fixed, typed shape (`taxEnabled`, `taxRate`, `notificationEmailEnabled`) rather than exposing raw key-value pairs to the frontend. Company Information, Logo, Receipt Footer, and Currency are **not** duplicated here — they've lived in Phase 2's `company_settings` since day one; this phase only adds what was genuinely missing.
- Gated by the `settings.view`/`settings.manage` permissions seeded back in Phase 0 (Super Admin only, by omission from every other role's grant) — no new permissions needed.

**Manual Database Backup**
- `backup.service.createBackup()` shells out to `mysqldump` via `child_process.spawn` with an argument array — never a shell string — so there's no injection surface even though the arguments come from trusted server config (`env.db.*`), and the password is passed via `MYSQL_PWD` in the child's environment, never on the command line where it could appear in a process listing.
- **Security-driven deviation from the original scaffold**: Phase 0's `FOLDER_STRUCTURE.md` had anticipated `backend/uploads/backups/.gitkeep` — but `uploads/` is statically served at `/uploads` (see `app.js`), which would make a full, unauthenticated database dump publicly downloadable by URL. Backups instead write to a dedicated `backend/backups/` directory outside the static-serving root, reachable only through a separate `settings.manage`-gated streaming download endpoint. This is exactly the kind of thing worth catching before it becomes a real vulnerability rather than after.
- Verified for real in this sandbox: no `mysqldump` binary is available here (same as every other phase, no live database exists in this session either) — calling `createBackup()` confirmed it fails gracefully, records a `failed` row in `system_backups`, and throws a clean `ApiError` with no leaked stack trace or internal detail. That's the exact failure mode a misconfigured production server would hit, and it's now provably handled.
- The `node-cron` scheduled-backup job from the original TODO is deferred — it's a new dependency plus app-startup wiring, and the "Critical"-priority need (a working manual trigger + history) is fully met without it.

**Self-Service Profile & Password**
- `src/pages/profile/` had existed as an empty folder since Phase 0's initial scaffold — never populated until now. `PUT /auth/profile` (name/phone/gender only — email/username/role/branch stay administrative, gated by `users.edit`) and `POST /auth/profile/avatar` reuse the exact upload middleware admin user-management already used.
- `PATCH /auth/change-password` requires the current password (unlike an admin's `users.edit`-gated reset of someone else's password, which doesn't), then revokes every session — the same force-relogin behavior `resetPassword()` already used for the forgot-password flow — so a stolen access token can't outlive a password change.
- `AuthContext` gained an `updateUser()` setter so a Profile edit reflects immediately in the Navbar (name, avatar) without waiting for the next token refresh.

**Frontend**
- Company/Tax & Email/Backups now read as one cohesive "Settings" section via a small shared `SettingsTabs` nav component — but the already-shipped, already-verified `CompanySettings` page itself was touched only additively (one import, one component insertion), not restructured, to avoid any risk to Phase 2's working code.

**Verification**
- Backend dry-run: all 8 new settings/profile endpoints return 401 pre-auth.
- Backup failure path verified directly (see above) rather than skipped for lack of a live database — the same "verify without a live DB" discipline used throughout this entire build.
- Frontend: Playwright confirmed `SettingsTabs` navigation, the System Settings form loading real tax data from the API, and the Profile page pre-filling the logged-in user's data with working password-strength validation — zero console errors.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; only the pre-existing `watch()` warnings, now on a fifth RHF form).

## Phase 22 — Notifications

**The one phase that reaches backward into five already-shipped modules** rather than starting clean. Phase 17's CHANGELOG explicitly promised "Notifications have no backing service until Phase 22 ships" — this is that promise honored: real triggers wired into Purchases, POS, Transfers, Expenses, and Returns, not a notification system sitting unused waiting for a future caller.

**Backend**
- `notification.repository.notifyBranchManagement(branchId, ...)`: the core design decision this phase. The `notifications` table's `user_id` column is nullable (schema anticipated broadcast notifications), but a single shared row can't have independent per-user read-state — one user marking a broadcast "read" would hide it for everyone. Instead, every notification is fanned out on write: one row per recipient, targeted at Super Admins plus the relevant branch's Manager(s) via one `INSERT ... SELECT`. Read-state is always unambiguous because no row is ever shared.
- Five triggers wired into existing services, each firing *after* that operation's own `COMMIT` (matching the same after-commit placement already used for `activityLogRepository.create()` in every one of these services): `purchase_completed` (`purchase.service`), `sale_completed` (`sale.service`), `transfer_completed` (`transfer.service`), `expense_submitted` (`expense.service`), `return_processed` (`return.service`).
- **Low stock** required extending `inventory.repository.recordMovement()` — the single source of truth for every stock change — to also fetch `COALESCE(inventory.min_stock, products.min_stock)` in the same locked `SELECT ... FOR UPDATE` it already runs, and return `crossedIntoLowStock: previousStock > minStock && newStock <= minStock`. This computes the crossing from data already being read/written in that transaction, so it's exact and free of extra queries. Callers (Sale checkout, Transfer approval's source-branch leg — the two flows that actually deplete stock; Purchases and Returns only add stock, so they can't newly cross into low-stock) check this flag after their own commit and notify only on the crossing, not on every subsequent sale of an already-low item.
- No permission gate on the notification routes — every authenticated user manages their own inbox, the same way everyone has their own Profile.

**Frontend**
- Navbar's notification bell (previously a static icon with no handler, added in Phase 5) is now fully wired: an unread-count badge polling every 60 seconds, a dropdown with the most recent notifications, per-item and mark-all-read actions.
- `/notifications`: the full inbox with All/Unread/Read tabs and pagination, reusing the same dot-color-by-type styling as the dropdown.

**Documented scope decision**
- **System Alerts are not generated this phase.** The category exists end-to-end (schema ENUM, dropdown rendering, list rendering) but nothing manufactures one — there's no scheduled job or health-check infrastructure yet to originate a system-level alert. Building a fake trigger just to populate the category would violate the standing no-placeholder rule; this is left ready for whenever that infrastructure exists.

**Verification**
- Because this phase modified `recordMovement()` — the function every prior transactional phase (Purchases, POS, Transfers, Returns) depends on and had already transaction-verified — it was re-verified with a fresh simulated `PoolConnection` test against the real, updated `sale.service.checkout`: confirmed the new JOIN'd `SELECT ... FOR UPDATE` query works, the low-stock crossing computes correctly (6→4 units against a threshold of 5), and both the `sale_completed` and `low_stock` notifications fire strictly after `COMMIT` — never during the transaction, where a later failure could still roll back the very stock change being described.
- Backend dry-run: all 4 notification endpoints return 401 pre-auth.
- Frontend: Playwright confirmed the Navbar badge shows the correct unread count, the dropdown lists recent notifications, and the full page's per-item mark-read works — zero console errors.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; only the pre-existing `watch()` warnings on RHF forms elsewhere).

## Phase 21 — Reports (Centralized Reports Center)

**Where every prior phase's data comes together.** 20 phases of building `sales`, `sale_items`, `purchase_orders`, `expenses`, `carwash_transactions`, `returns`, `stock_transfer_requests`, and the rest pays off here: all 12 reports are genuine aggregate SQL against those tables — the spec's "Reports must be generated from live database data, no hardcoded values" rule was true by construction, not something to retrofit.

**Backend**
- `report.repository`/`report.service`: one function per report type — Sales, Inventory, Purchases, Expenses, Car Wash, Profit, Branches, Products, Customers, Suppliers, Returns, Transfers — dispatched through a single `GET /reports/:type` endpoint. Each returns a `summary` (KPI figures) and one or more named breakdown arrays (`byDay`, `byBranch`, `byCategory`, `topProducts`, etc.), branch-scoped via the same `getAccessibleBranchIds()` every other module already uses, with a date range defaulting to month-to-date when not specified.
- **Profit** is the one report that reaches across domains: `(sales revenue + car wash revenue) − cost of goods sold − expenses`. COGS is computed from `sale_items.quantity × products.buying_price` at the moment of sale — the same formula Dashboard's KPIs (Phase 6) already use, so a manager comparing the Dashboard's "This Month's Profit" against the Reports Center's Profit report for the same date range sees matching numbers, satisfying the spec's "Dashboard KPIs must use the same report calculations" rule directly rather than by coincidence.
- Purchases aren't subtracted as a cost in the profit calculation — they become inventory (an asset) at receipt; COGS at the moment of sale is what actually reduces profit. This is a deliberate accounting choice, not an oversight.

**Frontend**
- `ReportsCenter.jsx`: one page, driven by a `REPORT_CONFIGS` map describing each report type's label, applicable filters, summary-field labels, and breakdown sections. A generic `BreakdownTable` component renders whatever array the current report returns — no per-report-type table markup needed, since every breakdown shares the same `{ label, ...numericFields }` shape.
- Filters shown adapt per report type (date range, branch, category, supplier) per `REPORT_CONFIGS`; a `cashierId` filter exists in the API already but isn't exposed in the UI yet (see deviation below).

**Documented scope decisions**
- **Export is Print + CSV, not PDF/Excel-native.** Print uses the browser's own `window.print()` with print-specific CSS (hiding sidebar/navbar/filters) — the same "let the browser handle it" choice made for POS receipts in Phase 17. CSV export is genuinely functional (a real file download, verified in this phase's Playwright pass) and, critically, opens directly in Excel — covering the practical spirit of "Excel export" without hand-building 12 report-specific PDF/Excel layouts. Dedicated PDF (pdfkit) and Excel-native (exceljs) exporters are left for a future pass; per the standing "no unfinished functions" rule, no button was added that doesn't actually work.
- **No Cashier filter in the UI yet.** The API already accepts `cashierId` on the Sales report, but building a permission-appropriate user picker (most Cashiers can't list all Users) felt like more plumbing than this phase's remaining scope justified — noted here rather than silently dropped.
- **Activity/Audit reports aren't duplicated here.** The spec lists 13 reports including one implicitly covered by the existing activity-log timeline (`activityLogRepository.findRecent()`, used since Phase 6) — that already exists as its own feature rather than needing a redundant "report."

**Verification**
- Backend dry-run: all 12 report-type endpoints (plus a request for an unknown type) return 401 before the type-validation logic even runs.
- Frontend: Playwright with mocked API confirmed KPI cards and breakdown tables render with live data, switching report type correctly re-fetches and re-renders (Sales → Profit), and clicking "CSV" triggers a real file download — zero console errors.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; only the pre-existing `watch()` warnings on RHF forms elsewhere).

## Phase 20 — Car Wash

**The simplest module in the system** — a single insert per transaction, no workflow, no inventory impact, `status` is a one-value ENUM. The spec calls it a "simple and professional Car Wash module" and the schema matches that exactly.

**Backend**
- `vehicle.repository`: vehicles are identified by plate number (unique), found-or-created as part of recording a wash rather than through a separate registration screen — matching a real front-desk flow where "Register Vehicle" and "Record Service" happen in the same conversation. A returning vehicle's customer name/phone are refreshed on each visit (cars change hands; the front desk always has the latest contact).
- `carwashService.repository`: read-only list of the 4 seeded services (Normal Wash, Full Wash, Engine Wash, Interior Cleaning) — no management UI, same reasoning as Expenses' fixed category list.
- `carwash.service.recordTransaction`: validates branch access and that the selected service is active, then does the vehicle find-or-create followed by one transaction-table insert. No explicit DB transaction wrapper needed — validation happens entirely before any write, so there's no partial-state risk a rollback would need to guard against, unlike Purchases/Transfers/POS/Returns where writes have to happen before some of the validation (e.g. stock checks against rows being written).
- Branch-scoped and filterable (service, branch, date range) the same way Expenses is, including a `totalAmount` aggregate for the current filter set powering a "Revenue (filtered results)" KPI.

**Frontend**
- `CarWash.jsx`: one page, one modal. Selecting a service auto-fills the Amount field with that service's price (still editable, matching the spec's fields listing Service and Amount separately), and the history table sits below with the same filter-toolbar pattern as Expenses.

**Verification**
- Backend dry-run: all 3 carwash endpoints return 401 pre-auth.
- Frontend: Playwright with mocked API confirmed history rendering with the correct filtered-revenue KPI, the service-price auto-fill interaction, and a full form fill — zero console errors.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; only the pre-existing `watch()` warnings, now on a fourth RHF form).

## Phase 19 — Expenses

**The simplest phase since Customers** — a straightforward branch-scoped CRUD module, deliberately so: the spec calls it "simple expense management" and lists only Create/Edit/Delete/Search/Filter, no workflow or approval step.

**Backend**
- `expense.repository`/`expense.service`: standard soft-delete CRUD, branch-scoped via the same `getAccessibleBranchIds()` every other branch-owned module uses (Inventory, Transfers, Sales, Returns). `findAll()` also returns a `totalAmount` aggregate for whatever filters are currently applied, so the frontend can show a live "total for these results" figure without a second request.
- Filtering covers category, branch, and date range (`dateFrom`/`dateTo`) plus free-text search on description — together these cover the spec's "Daily Expenses / Monthly Expenses / Category Summary / Branch Expenses" report shapes as filter combinations on one list, rather than four separate report pages (Phase 21 Reports is where dedicated report pages belong).
- `expense_categories` stays read-only this phase (`GET /expenses/categories`, no create/edit/delete). The spec's feature list for Expenses doesn't include managing categories — only picking from the fixed set seeded in Phase 0 (Rent, Electricity, Water, Fuel, Salary, Maintenance, Transport, Office Supplies, Other) — so no category-management UI or endpoints were built, keeping the module exactly as "simple" as specified.
- The `expenses.status` column (`pending`/`approved`) always writes `'approved'` — there's no `expenses.approve` permission in the seeded role matrix and the spec describes no approval workflow, so exposing an unreachable `pending` state in the UI would be a dead end. The column stays available for a future workflow without any rework needed here.

**Frontend**
- `ExpenseList`: modal create/edit (Suppliers/Customers pattern), a KPICard showing the filtered total, and toolbar filters for category/branch/date range alongside search.

**Verification**
- Backend dry-run: all 6 expense endpoints return 401 pre-auth.
- Frontend: Playwright with mocked API confirmed the list renders with the correct filtered-total KPI, required-field validation blocks an empty submit, and the form fills correctly — zero console errors.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; only the pre-existing `watch()` warnings on other RHF forms).

## Phase 18 — Returns

**The mirror image of Purchases**: where Purchases increases stock on receipt, Returns increases stock on approval — reusing `recordMovement()` a fourth time (movement type `return`, positive quantity), and reusing the exact pending→approve/reject shape Transfers established in Phase 15. Every return points back to a specific `sale_items` row rather than a bare product, which is what makes "cannot return more than sold quantity" and refund-amount calculation both exact.

**Backend**
- `return.service.createReturn`: locates the original sale, requires it to be `completed` (not voided), and for every selected line validates it actually belongs to that sale and that `requested quantity + already-returned quantity` (summed across every *non-rejected* prior return against that same sale line, not just the current request) doesn't exceed what was sold. Refund amount is computed per line from the sale item's actual paid price — `line_total / quantity` — so a line that had a POS-time discount refunds correctly instead of refunding the pre-discount list price. Request creation is its own transaction (header + items) but has no inventory impact yet, same as a Transfer request.
- `approveReturn`: one transaction — `recordMovement()` per return line (restocking the branch the original sale was made from) followed by a conditional `status = 'pending'` → `'approved'` update that also flips `refund_status` to `'refunded'` in the same statement, all on one connection. Rejecting is a status-only change that never touches inventory or refund_status.
- Return numbers (`RET-2026-000001`) reuse Phase 9's sequence engine, matching every other document type.
- Branch access follows the same rule as Transfers: scoped to the branch of the underlying sale.

**Frontend**
- `ReturnForm`: "Locate Original Sale" search by sale number (reusing the existing sale-list search), then a checkbox+quantity table per sold line, reason and refund-method selects.
- `ReturnList` and `ReturnDetail` follow the Transfers list/detail-with-approve-reject pattern exactly — status badges, Approve/Reject behind `returns.approve` and a confirmation dialog, shown only while pending.

**Documented scope decision**
- The return-quantity input's client-side max is the line's full sold quantity, not "sold minus already returned" — computing the latter live would need a new endpoint exposing per-line returned-quantity, which felt like more plumbing than this phase's remaining time justified. The server is the authoritative check regardless (same trust model used for POS stock and Transfer availability) and returns a clear error naming the product if the cumulative cap is exceeded.

**Verification**
- Return approval's inventory restock verified with a simulated `PoolConnection` exercising the real `approveReturn` service directly: success path confirmed both lines restock and the status/refund update commit together in one `COMMIT`; failure path (simulated error on the second line's inventory update) confirmed `ROLLBACK` fires before the status/refund update ever runs, `COMMIT` never fires, and the connection is still released.
- Backend dry-run: all 5 return endpoints return 401 pre-auth.
- Frontend: Playwright with mocked API drove locate-sale → select-item → detail-with-actions end-to-end, zero console errors.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; only the pre-existing `watch()` warnings on other RHF forms).

## Phase 17 — POS (Sales Engine)

**The largest and most consequential phase so far** — the point-of-sale terminal is where every other module converges: it decrements the same `inventory` table Purchases/Transfers write to, attaches to Customers, and is the first real consumer of two previously-built-but-idle pieces — Phase 11's `QRScanner.jsx` (built then, unused until now — confirmed via build output going from 0 bytes to a real chunk) and Phase 10's `recordMovement()` composable design, now proven a third time in a third shape (single-direction for Purchases, dual-branch-pair for Transfers, now a per-line-item loop for POS).

**Backend**
- `sale.service.checkout`: the full spec sequence — validate branch access, validate customer, validate every line's product/price-authority/stock/discount-limit, validate payment coverage — all *before* opening a connection, then one all-or-nothing transaction: insert the sale header, every `sale_items` row, a `recordMovement()` call per line (movement type `sale`, negative quantity), and every `sale_payments` row. Commit once; roll back everything on any failure, matching the spec's explicit "Sale processing MUST use MySQL transaction... Never allow partial sales" rule.
- Discount authority: reused Phase 4's `permission.repository.getCodesForRole()` directly (the same lookup `authorize()` middleware uses, just called from the service layer) to check for `sales.manage` at checkout time. Actors without it are capped at 10% of the relevant subtotal on both line-item and cart-level discounts, and may not override a line's unit price — the spec's three-tier "Cashier: Limited / Manager: Extended / Super Admin: Full" discount authority, made concrete since the spec didn't give numbers.
- Sale numbers (`SAL-2026-000001`) reuse Phase 9's sequence engine, 6-digit padding like Purchases/Transfers.
- Mixed payments: `sale_payments` accepts any number of rows in any combination of methods; `sum(payments) >= total` is the only server-side constraint, matching the spec's mixed-payment business rule exactly.
- `GET /products/sellable`: a new, purpose-built branch-scoped product read (active products + live per-branch stock) added to `product.repository`/`product.service` specifically to back the POS grid — kept separate from the Products admin list and Inventory admin list rather than overloading either with POS-specific shape/filtering.
- `receipt.service.buildReceiptPdf`: an 80mm-width, thermal-receipt-shaped PDF via pdfkit, following the exact pattern Phase 12's Label Printing established (mm-to-point conversion, streamed buffer). Pulls company name, address, phone, and footer message from Phase 2's `company_settings` (whose `receipt_footer` column existed since Phase 2 specifically for this).

**Frontend**
- `POS.jsx`: the split-screen terminal — product grid with category pills and instant search on the left, cart and checkout on the right. Branch context comes from the logged-in user (locked for Cashier/Manager, selectable for Super Admin, consistent with the branch-scoping used everywhere else).
- QR scanning: tapping "Scan QR" opens `QRScanner` in a modal; the decoded payload's `productId`/`code` is resolved against the live sellable-products list (so stock is always current) and added to cart — the QR-code architecture decision from Phase 11 (payload omits branch, since the scanning terminal already knows its own branch) pays off here exactly as designed.
- Cart: per-line quantity capped at available stock, price input disabled unless the viewer holds `sales.manage`, per-line and cart-level discount inputs, live totals.
- Payment: add/remove rows for mixed payments, live change/balance-due as amounts are typed.
- Checkout navigates straight to `SaleDetail`, which doubles as the immediate post-sale receipt screen and the later reprint screen from Sale History — one page, two entry points, no duplicated receipt UI.

**Deliberate scope decisions (documented deviations)**
- **Receipt Preview/Print/Download/Reprint** all resolve to one action: open the PDF in a new browser tab. The browser's native print dialog and "Save as PDF" cover Print and Download without separate endpoints or a custom in-app PDF viewer — simpler and matches how Label Printing (Phase 12) already worked.
- **Sale History omits a "Payment Method" column.** A sale can have mixed payments (several methods on one sale), so a single-column value would be misleading; the full payment breakdown is one click away on Sale Detail instead.
- **Hold Sale is deferred, not started.** The spec explicitly scopes it as "prepare architecture" only for this phase — but starting it would mean adding a `held` sales status and a save/resume flow with no real usage yet, and per the "never leave... unfinished functions" discipline, a non-functional stub isn't an acceptable substitute. Left off this phase's TODO as an honest gap rather than checked off; revisit if a later phase needs it.
- **No tax calculation.** `sales.tax_amount` is always 0 — no tax rate is configured anywhere in the schema or company settings, and inventing a VAT rule not in the spec would be scope creep. The column exists and is wired through so a future Settings phase can activate it with zero rework.
- **Audit Logs and Notifications are not written from checkout.** Every phase so far (Purchases, Transfers, Customers) has used only `activity_logs`, never `audit_logs` — POS follows that same established precedent rather than introducing a new logging path unilaterally. Notifications have no backing service until Phase 22 ships.

**Verification**
- Checkout transaction safety verified the same way as Purchases (Phase 14) and Transfers (Phase 15) — a simulated `PoolConnection` exercising the real, unmodified `checkout` service directly. Success path (2 line items, 1 payment) confirmed the exact sequence: sale header insert → per line (`sale_items` insert → inventory `SELECT...FOR UPDATE`/`UPDATE`/movement insert`) → payment insert → one `COMMIT`. Failure path injected a simulated error on the second line's inventory update (after the first line's full flow and the second line's item insert had already happened inside the same uncommitted transaction) — confirmed `ROLLBACK` fires, `COMMIT` never does, no payment is ever inserted, and the connection is still released.
- Backend dry-run: all 5 sale/POS endpoints (list, get, receipt, checkout, sellable products) return 401 pre-auth.
- Frontend: Playwright with mocked API drove the full flow — grid renders, clicking a product twice increments cart quantity, the price-override input is correctly disabled for a Cashier without `sales.manage`, totals compute correctly, checkout navigates to the receipt/detail screen — zero console errors, two screenshots confirming a polished, on-brand terminal.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; the POS route's own chunk is larger than most — expected, since it's `html5-qrcode`'s real weight now actually bundled for the first time — but still under Vite's 500kB warning threshold and lazy-loaded only on `/pos` visits).

## Phase 16 — Customers

**A straightforward CRUD module** that sets up two future phases: POS (Phase 17) needs a customer picker, and both POS and Returns (Phase 18) need a `customer_id` to attach sales/returns to. This phase builds the entity and its history views; the history stays correctly empty until those phases populate `sales`/`returns`.

**Backend**
- `customer.repository`/`customer.service`: full CRUD plus deactivate, following the exact shape established by Suppliers (Phase 13) — `findAllActive()` for lightweight dropdown lookups (ready for POS), paginated `findAll()` with search across name/business name/phone/code, and a status toggle gated the same way (`customers.edit`, not a separate delete permission).
- Customer codes (`CUST-2026-00001`) generated via Phase 9's sequence engine, matching the Product code pattern (5-digit padding).
- All 5 customer types from the spec supported as an enum: walk-in, retail, wholesale, VIP, business.
- `getCustomer()` merges the customer record with lifetime stats (total orders, total spent, total returns) computed via real aggregate queries against `sales`/`returns` — both tables exist from Phase 0 but are empty until Phases 17/18 ship, so this correctly returns zeros today with no rework needed later. `getPurchaseHistory()`/`getReturnHistory()` are the same real-query-against-empty-table pattern, paginated.
- Duplicate phone numbers are rejected automatically by the `customers.phone` unique constraint — the existing global error handler already converts `ER_DUP_ENTRY` into a clean 409 without leaking SQL, so no extra service-layer duplicate check was needed.

**Frontend**
- `CustomerList`: modal create/edit (the wider `lg` modal size, given customers have more fields than Suppliers — first/last name, business name, phone, alt phone, email, address, region, district, TIN, type, status), status badges, deactivate toggle.
- `CustomerDetail`: three KPI cards (Total Orders, Total Spent, Total Returns) followed by separate Purchase History and Return History tables, each with its own independent pagination via two `useTable()` instances on one page.

**Verification**
- Backend dry-run: all 8 customer endpoints (`/customers/active`, list, get, purchases, returns, create, update, status) correctly return 401 pre-auth.
- Frontend: Playwright with mocked API confirmed list rendering, the create-form's required-field validation (phone required, blocks submit), and the detail page rendering its KPI cards plus the correctly-empty purchase/return history tables — zero console errors.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; only the pre-existing `watch()` React Compiler warnings on other RHF forms).

## Phase 15 — Stock Transfers

**The first module with a genuine two-step workflow**: creating a transfer only reserves a `pending` request — no stock moves until a Manager or Super Admin approves it. Approval is also the first place `recordMovement()` is called *twice* inside one transaction, proving out Phase 10's composable design a step further than Purchases (which called it once per line item, always in the same direction).

**Backend**
- `transfer.repository`/`transfer.service`: `createTransfer` validates source ≠ destination, both branches exist, every product exists, and the requested quantity doesn't exceed available stock at the source branch (a new `inventoryRepository.getAvailableQuantity()` read helper) — all before opening a transaction that inserts the request header and every line item atomically.
- `approveTransfer`: one transaction, one connection. For every line item, `recordMovement()` runs twice on that connection — `transfer_out` (negative) at the source, `transfer_in` (positive) at the destination — then the request flips from `pending` to `approved` via a conditional `UPDATE ... WHERE status = 'pending'` that also guards against two concurrent approvals both succeeding. Everything commits together or rolls back together.
- `rejectTransfer`: a status-only change (no inventory impact), guarded by the same conditional-update pattern.
- Branch access control: requesting a transfer requires access to the source branch; approving/rejecting requires access to either side of the transfer (source or destination) — reuses Phase 5's `getAccessibleBranchIds()`, unrestricted for Super Admin.
- Transfer numbers (`TRF-2026-000001`) reuse Phase 9's sequence engine with 6-digit padding, same as Purchases.
- Routes gated by `transfers.view` / `transfers.create` / `transfers.approve`, matching the seeded role matrix (Manager gets all three, Store Keeper gets view + create only, matching the spec's "Approve (Manager / Super Admin)" rule).

**Frontend**
- `TransferForm`: selecting a source branch fetches its live inventory (`GET /inventory?branchId=`) to populate the product picker with real available quantities, and flags a line inline if the typed quantity exceeds what's available — before the request ever reaches the server. Destination branch is validated client-side to differ from the source.
- `TransferList` shows status with color-coded badges (pending/approved/rejected). `TransferDetail` shows Approve/Reject buttons only when the transfer is still pending and the viewer holds `transfers.approve`, each behind a `ConfirmDialog`.

**Verification**
- Transaction safety verified the same way as Phase 14's Purchases — a simulated `PoolConnection` calling the real, unmodified `approveTransfer` service directly:
  - **Success path**: asserted the exact sequence for two line items — source `SELECT...FOR UPDATE → UPDATE → INSERT movement (transfer_out)`, then destination `SELECT...FOR UPDATE → UPDATE → INSERT movement (transfer_in)`, repeated per line, followed by the status update and exactly one `COMMIT`.
  - **Failure path**: simulated a DB error on the *second* inventory update (the destination leg of the first line item, after the source leg had already "succeeded" within the same uncommitted transaction) — asserted `ROLLBACK` fires, `COMMIT` never does, and the connection is still released. Confirms a transfer can never leave stock deducted from one branch without landing at the other, even under mid-transaction failure.
- Backend dry-run (booting `app.js` directly, bypassing `server.js`'s DB-connectivity gate since no live database exists in this session): all five transfer endpoints (`GET /transfers`, `GET /transfers/:id`, `POST /transfers`, `POST /transfers/:id/approve`, `POST /transfers/:id/reject`) correctly return 401 with the standard safe error envelope pre-auth.
- Frontend: Playwright with mocked API confirmed list rendering, the source-branch-driven stock picker, client-side same-branch validation blocking submit, and the detail page's Approve/Reject actions rendering for a pending transfer — zero console errors.
- `npm run lint` (frontend + backend) and `npm run build` clean (0 errors; only the pre-existing `watch()` React Compiler warnings on other RHF forms).

## Phase 14 — Purchases

**The first real multi-step financial transaction in the app**, and the first real consumer of Phase 10's `recordMovement(data, connection?)` composable design — validating that architectural bet.

**Backend**
- `purchase.service.createPurchase`: one connection, one transaction, from order header through every line item's inventory movement. Validates supplier/branch/every product exist *before* opening the transaction (fail fast on bad input without ever touching a connection), then inside the transaction: insert `purchase_orders`, insert each `purchase_items` row, call `recordMovement()` per line passing the **same connection** so stock increments are part of the same atomic unit as the order itself. Any failure at any point rolls back everything — no partial purchase, no partial stock increment, matching the spec's explicit rule.
- Purchase numbers (`PUR-2026-000001`) reuse Phase 9's `document_sequences` engine with 6-digit padding (vs. products' 5-digit).
- `POST /purchases/payments` records supplier payments independently of a specific purchase order (a payment can apply against a supplier's running balance generally), feeding Phase 13's `getBalance` calculation.

**Frontend**
- `PurchaseForm`: the first multi-line dynamic form in the app, using React Hook Form's `useFieldArray` for add/remove line items, with live per-line and grand-total calculation as quantities/prices are typed.
- `PurchaseList` + `PurchaseDetail` follow the established list/detail pattern; outstanding balance display isn't duplicated here since it already lives on the Supplier detail page from Phase 13.

**Verification — the most rigorous of any phase so far**
- No live database exists in this session, but transaction-safety is exactly the property that matters most here, so a live DB alone wouldn't even be sufficient — what's needed is proof the *control flow* is correct under failure. Built a simulated `PoolConnection` (mock `query`/`beginTransaction`/`commit`/`rollback`/`release`) and called the **real, unmodified** `createPurchase` service function against it twice:
  - **Success path**: asserted the exact call sequence — `BEGIN → INSERT purchase_orders → INSERT purchase_items → SELECT inventory FOR UPDATE → UPDATE inventory → INSERT inventory_movements → COMMIT → RELEASE` — confirming `recordMovement()` really does participate in the outer transaction rather than opening its own.
  - **Failure path**: simulated a DB error on the `UPDATE inventory` step (after the order and item rows had already been inserted within the same uncommitted transaction) and asserted `ROLLBACK` fires, `COMMIT` never does, the connection is still released, and the error propagates to the caller.
  - Caught a real bug in the test harness itself along the way (an ambiguous SQL-substring match caused a mock to return the wrong shape for `recordMovement`'s `SELECT ... FOR UPDATE`) — a good reminder that mock-based verification needs the same care as the code it's verifying.
- Backend dry-run: `/purchases` correctly 401s pre-auth.
- Frontend: Playwright confirmed the multi-line form's live total calculation and "Add Line" behavior, zero console errors.

## Phase 13 — Suppliers

**Backend**
- Standard CRUD following the Categories/Brands/Branches pattern, plus two real queries that only Phase 14 (Purchases) will start populating: `findPurchaseHistory` (paginated `purchase_orders` for a supplier) and `getBalance` (`SUM(purchase_orders.total_amount) - SUM(supplier_payments.amount)`). Both correctly return empty/zero today rather than being stubbed — same "real query against an existing-but-unpopulated table" pattern used for Dashboard KPIs (Phase 6) and Category/Brand product-counts (Phases 7-8).

**Frontend**
- `SupplierList`: modal create/edit (matches Roles/Categories/Brands), row-level Activate/Deactivate toggle.
- `SupplierDetail` (new page shape for this phase): KPI balance cards (Total Purchased / Total Paid / Outstanding Balance, reusing Phase 6's `KPICard`) above a paginated purchase history table — the first "detail page with real sub-data" in the app, since Categories/Brands/Roles never needed one.

**Verification**
- Backend dry-run: supplier endpoints correctly 401 pre-auth.
- Frontend: Playwright with mocked API — list and detail page (explicitly showing the correctly-empty "No purchases recorded yet" state and zero balances) both screenshotted, zero console errors.

## Phase 12 — Label Printing

**Backend**
- `label.service.js` generates a real multi-label PDF with `pdfkit`: given a list of product IDs and a size key (`small`/`medium`/`large`, each with real mm dimensions converted to PDF points), it computes how many labels fit per row/column on an A4 page and auto-paginates — not a fixed "N per page" constant, so the small/medium/large sizes actually fit meaningfully different label counts per sheet.
- Branch is accepted as a **print-time query/body parameter only** (resolved to a name and printed as informational text), not stored or baked into the QR — consistent with Phase 11's resolution that products don't have a single owning branch.
- Reuses `qrCodeService.getForProduct()` (auto-generates a QR on first request if one doesn't exist yet) rather than requiring the QR to have been generated separately first.
- Added `backend/utils/formatCurrency.js` — a backend-side twin of the frontend's currency formatter (Node and the browser bundle are separate module graphs, so the frontend util isn't reachable from backend code; duplicating this one small pure function was simpler and more honest than trying to share code across the client/server boundary for a single formatter).

**Frontend**
- `QRCodeDisplay`'s "Print Label" button now calls the real backend PDF endpoint instead of Phase 11's placeholder `window.print()` on a manually-constructed HTML string — same visual entry point, properly formatted output.
- `ProductList` gains a "Print Labels (N)" bulk action, appearing alongside the existing Activate/Deactivate buttons once rows are selected — reuses Phase 9's row-selection state, no new selection mechanism.
- `labelService.js`: fetches the PDF as a blob (`responseType: 'blob'`) and opens it in a new tab via an object URL, revoked after 30s — lets the browser's native PDF viewer handle preview/print/save rather than building a custom in-app PDF viewer.

**Verification**
- Backend: a **functional** pdfkit smoke test (not just `node --check`) replicated the exact `rect`/`image`/`text` drawing sequence used in `label.service.js` against a real fixture PNG and confirmed valid PDF bytes are produced — catches pdfkit API misuse that a syntax check alone would miss.
- Backend dry-run: both label endpoints correctly 401 pre-auth.
- Frontend: Playwright confirmed the trickiest part of this feature — fetch → blob → new-tab — actually works, by asserting the popup window's URL starts with `blob:` after clicking "Print Labels". Zero console errors.

## Phase 11 — QR Codes

**Spec deviation, deliberate and documented:** `MASTER_PROMPT.md` says the QR payload should include Branch ID. Since Phase 0 locked in a shared-catalog architecture (one `products` row per SKU, stock tracked per branch in `inventory`), a product has no single branch to encode — baking one in would be wrong for anything stocked at multiple branches. Resolution: the QR encodes `{ productId, code, name, sellingPrice }` only; the scanning POS terminal supplies branch context from its own session at scan time, in Phase 17.

**Backend**
- `qrCode.service.js` generates via the `qrcode` package (installed since Phase 0), writing to `backend/uploads/qrcodes/`.
- Filenames are **versioned per regeneration** (`product-{id}-v{n}.png`), not overwritten in place — a stable filename that changes content would risk browsers serving a cached stale image after "Regenerate." The old file is deleted after the new one is written (best-effort, non-fatal on failure, same pattern as company logo / avatar replacement from Phases 2-3).
- `qr_codes` is treated as one row per product (upsert: update-in-place + increment `regenerated_count` if a row exists, insert otherwise) — matches the schema's audit-trail-via-counter design rather than keeping literal historical rows.

**Frontend**
- `QRCodeDisplay` (in `components/products/`): preview, Download (native `<a download>`), Print (opens a minimal print window with just the QR + product name/code — not the full page chrome), Regenerate. Embedded directly in the Product edit page rather than a separate route, consistent with every other module's "no dedicated detail page" pattern.
- `QRScanner` (in `components/common/`, reusable): wraps `html5-qrcode`'s camera scanning lifecycle. Not consumed by any page yet — Phase 17 (POS) is its first real user — and confirmed via the production build that an unused component with a real dependency (`html5-qrcode`) correctly contributes zero bytes to the bundle (tree-shaken), rather than silently bloating it while sitting unused.

**Verification**
- Backend dry-run: `GET /products/:id/qr` correctly 401s pre-auth.
- Frontend: Playwright with a real PNG fixture (not just a mocked JSON response) serving as the QR image, to confirm the `<img>` tag actually renders bytes rather than just a URL string — the QR card, product edit page layout, and all three action buttons screenshotted, zero console errors.

## Phase 10 — Inventory

**The most architecturally important backend piece so far:** `inventory.repository.js`'s `recordMovement()` is the single function every future stock-affecting phase (Purchases, POS, Transfers, Returns) will call instead of writing their own `UPDATE inventory` logic. Getting its contract right now avoids four future phases each reinventing (and potentially getting slightly wrong) the same stock-mutation rules.

**Backend**
- `recordMovement(data, externalConnection?)`: locks the inventory row with `SELECT ... FOR UPDATE`, creates it on first touch, computes `newStock`, rejects negative results with a `422` (enforced at the data layer, not just in a form — every future caller inherits this for free), updates `inventory.quantity`, and inserts the `inventory_movements` row — all in one transaction. Accepts an optional external DB connection specifically so a future POS checkout (sale + payment + inventory decrement, all-or-nothing) can pass its own transaction connection through instead of this function managing a separate one; called standalone (as Adjustments do today), it manages its own transaction.
- `inventory.service.js` is branch-scoped via Phase 5's `branchScope.js` throughout — list, summary, and movements all respect "Super Admin sees all, others see their branch(es)." Adjustment creation additionally checks the acting user actually has access to the target branch before recording anything.
- **Deliberately not implemented:** the adjustment approval workflow. The schema already supports it (`requires_approval`/`approved_by`/`approved_at`), but `MASTER_PROMPT.md` never specified a concrete threshold for when approval should trigger, and guessing one felt worse than being explicit that adjustments are currently auto-approved. Documented as a known gap in `docs/TODO.md` rather than silently skipped.
- Route-level permission split matches the Phase 0 seed data exactly: both `inventory.view` and `inventory.adjust` are required to create an adjustment, which correctly allows Store Keeper (has both) and blocks Manager (has `view` + `approve`, not `adjust`) — Manager's role is to approve, not adjust directly, per the spec's per-module permission tables.

**Frontend**
- `InventoryOverview`: summary KPI cards (reusing Phase 6's `KPICard`), branch/low-stock/out-of-stock filters, and a color-coded stock-level badge per row (green/amber/red) computed client-side from quantity vs. min-stock.
- `StockMovements`: full audit trail with signed quantity display (green `+12` / red `-3`) and a movement-type badge per row.
- Adjust Stock is a modal opened from the overview table (pre-filled with the product/branch context), not a separate page — consistent with how Categories/Brands/Roles handle small, single-purpose forms.

**Verification**
- Backend dry-run: `/inventory` and `/inventory/movements` correctly 401 pre-auth.
- Frontend: Playwright with mocked API — summary cards, stock-level badges (in/low/out), the Adjust Stock modal with correct product context, and the movement history table all screenshotted. Zero console errors.

## Phase 9 — Products

**Backend**
- `sequence.repository.js`: the reusable numbering engine `document_sequences` was designed for back in Phase 0. Uses MySQL's `INSERT ... VALUES (..., LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)` idiom — atomic and race-condition-safe under concurrent product creation without needing an explicit transaction or row lock. The `LAST_INSERT_ID(1)` on the insert branch (not just the update branch) was a deliberate fix — without it, the very first code for a new category/year would return the row's raw auto-increment `id` instead of `1`, since `LAST_INSERT_ID()` only applies automatically to a plain `INSERT`'s primary key, not to a manually named counter column.
- **Product codes are category-code-prefixed** (`CRT-2026-00001`, `WLD-2026-00001` — matches `MASTER_PROMPT.md`'s literal examples `SPR-2026-00001`/`DEC-2026-00001` exactly), reusing each category's existing unique `code` field from Phase 7 rather than inventing a separate prefix scheme. Each category gets its own counter (`document_type = PRODUCT_<categoryCode>`), so two categories' codes both correctly start at `00001`.
- Buying-price > selling-price guard: returns `422` with a structured `PRICE_OVERRIDE_REQUIRED` error code (not a generic message) so the frontend can distinguish "needs confirmation" from "actually invalid" and re-submit with `confirmPriceOverride: true`.
- `hasTransactionHistory(id)` checks `sale_items`/`purchase_items` before allowing delete — real queries against tables that exist since Phase 0, correctly permissive today and correctly protective once Purchases/POS ship.
- Product images reuse Phase 2's `createUploader` factory (subfolder `products`, 3MB limit) — third consumer after company logos and user avatars, no new upload plumbing needed.

**Frontend**
- `ProductList`: adds row-selection checkboxes + bulk activate/deactivate on top of the standard `useTable`/`Table` pattern — the first list page needing multi-select, kept local to this page rather than generalized into `Table` since nothing else needs it yet.
- `ProductForm`: image gallery (upload/remove/primary badge, edit-mode only — same reasoning as Phase 3's avatar upload, needs a product ID first) and the price-override confirmation flow (submit → catch `422` → inline warning banner with "Save Anyway" → resubmit with the confirmation flag, values preserved via React Hook Form's `getValues()`).
- No dedicated Product **detail** page — folded into the edit form, consistent with every list module so far (Users, Branches, Categories, Brands). A future QR/stock-focused detail view naturally belongs to Phase 10 (Inventory) and Phase 11 (QR Codes) once there's real stock/QR data to show.

**Explicitly deferred:** image compression/resizing. Multer validates type and a 3MB size cap but doesn't re-encode. Not a real problem yet at this scale — flagged to revisit (e.g. `sharp`) if upload sizes become an issue in practice, rather than adding a dependency preemptively.

**Verification**
- Backend dry-run: product endpoints correctly 401 pre-auth.
- Frontend: Playwright with mocked API — product list (generated codes, category/brand filters, bulk-action reveal on selection) and the complete price-override flow (intentionally submitted buying price 50,000 > selling price 30,000, confirmed the `422`+warning-banner+resubmit round-trip works end-to-end) both screenshotted. Zero console errors (the single 422 in the network log is the test intentionally exercising the rejection path, not a bug).

## Phases 7-8 — Categories & Brands (Master Prompt Phase 2: Inventory Management Engine begins)

Two small, near-identical catalog modules, built together. Both follow the exact CRUD-with-modal pattern established by `RoleList` (Phase 4) rather than a full separate form page — appropriate given each has only 3-4 fields.

**Backend**
- `category.repository.js`/`brand.repository.js`: standard CRUD plus `countProducts(id)` — a real query against the `products` table (which exists since Phase 0) that correctly returns 0 today and starts blocking deletion the moment Phase 9 ships products referencing a category/brand. No stubbing, same pattern as Phase 6's dashboard KPIs.
- Both enforce uniqueness on name *and* code (spec only mentioned name; code uniqueness is an obvious necessary addition since codes are meant to be short stable identifiers, e.g. for future product-code prefixing).
- `/active` lookup endpoints added preemptively for Phase 9's Product form dropdowns, mirroring the Branches pattern from Phase 5.

**Frontend**
- `CategoryList`/`BrandList`: `useTable` + `Table` + `Pagination` + `SearchInput` for the list, `Modal` + React Hook Form for create/edit, `ConfirmDialog` for delete. Zero new reusable infrastructure needed — this is the payoff of Phase 3's investment in shared components.

**Verification**
- Backend dry-run: both list endpoints correctly 401 pre-auth.
- Frontend: Playwright with mocked API — category list, the New Category modal, and the brand list (country column, active/inactive badges) all screenshotted, zero console errors.

## Phase 6 — Dashboard (completes Master Prompt Phase 1: Core ERP Foundation)

**The architectural payoff of Phase 0's complete-schema-upfront decision:** every KPI and chart the spec asks for (Sales, Purchases, Inventory, Customers, Suppliers, Car Wash, Transfers — none of which have their own CRUD/business-logic modules yet) can be queried for real right now, because all 42 tables already exist from Phase 0. No stub data, no hardcoded zeros, no TODO placeholders — genuine `SELECT`/`SUM`/`GROUP BY` queries against real tables that simply return 0/empty until Phases 7-21 start writing rows, then light up automatically with zero further backend work.

**Backend**
- `dashboard.repository.js`: all 14 KPIs (today/monthly sales & profit, customers, suppliers, products, inventory value, low-stock count, today/monthly expenses, car wash revenue, pending transfers/purchases) and all 8 chart types (sales/revenue/expense/profit trend, top products, branch performance, inventory summary, car wash summary). Profit is computed as `line_total - (quantity × buying_price)` per sale item, not stored redundantly.
- First real consumer of Phase 5's `branchScope.js`: every KPI/chart query is branch-scoped (`getAccessibleBranchIds`), so Super Admin sees everything and Managers/Cashiers see only their branch(es) — exactly the business rule that utility was built for, now proven end-to-end.
- Caught and fixed a fragile pattern while writing this: initially used `.replace('branch_id', 'i.branch_id')` string substitution to adapt a filter clause for a different table alias. Replaced with building the filter with the correct alias from the start — string-editing generated SQL fragments is a real correctness risk (silent wrong replacements) that isn't worth the shortcut.
- `GET /search`: global search, **users-only for now** — the only entity that exists. Response is `{ users: [...] }`, shaped to add `products`/`customers`/`suppliers`/etc. keys without a breaking change as later phases ship.

**Frontend**
- `components/charts/`: `LineChart`, `BarChart`, `DoughnutChart` — thin `react-chartjs-2` wrappers themed to the gold/black brand palette (`chartTheme.js` duplicates the CSS custom properties as hex constants, since Chart.js can't read CSS vars directly).
- `components/dashboard/`: `KPICard`, `ChartCard` (loading/empty states), `ActivityTimeline`, `QuickActions`.
- **Quick Actions are visibly disabled**, not hidden and not linking to dead pages — all 8 spec'd actions (New Sale, New Product, etc.) target routes that don't exist until Phases 8-21. This matches the master prompt's own Implementation Order (Dashboard is step 7, those pages are steps 8-21), so building working links now was never possible; each action flips to enabled the moment its owning phase adds the route.
- Navbar's search input (static since Phase 0) is now functionally wired: debounced query, dropdown results, click-outside-to-close, navigates to the matched user's edit page.
- `utils/formatCurrency.js`: `formatCurrency`/`formatNumber` via `Intl.NumberFormat`, currency defaults to TZS.

**Verification**
- Backend dry-run: all dashboard and search endpoints correctly 401 before authentication.
- Frontend: Playwright with mocked KPI/chart/activity/search responses — confirmed all 14 KPI cards, all 8 charts (rendering real Chart.js canvases, not placeholders), the activity timeline, the quick actions grid, and the wired search dropdown, all in one full-page screenshot. Zero console errors on what is by far the most complex page built so far.
- `vite build`: Dashboard is its own 198KB lazy chunk (Chart.js is heavy but only loads when the Dashboard route is visited) — the code-splitting work from Phase 5 paid off immediately.

## Phase 5 — Branches

**Backend**
- Full Branch CRUD. Deactivation is blocked while any user is still assigned to the branch (same pattern as Phase 4's role-deletion guard) — reassign staff first, then deactivate.
- `utils/branchScope.js`: `getAccessibleBranchIds(user)` returns `null` for Super Administrator (unrestricted) or the concrete list of accessible branch IDs (primary `branch_id` + `user_branches`) otherwise. This is infrastructure only for now — nothing branch-owned exists yet to scope (Sales, Purchases, Inventory, Expenses all come later) — but it's built once here so every later phase's service layer just calls it instead of reinventing branch-visibility logic.
- Split the branches endpoint in two: `GET /branches/active` (lightweight name+code lookup for dropdowns, any authenticated user — used by Phase 3's User form) vs. `GET /branches` (full paginated/searchable listing, requires `branches.view`). Existing frontend dropdown consumer updated to match.

**Frontend**
- `BranchList`/`BranchForm` follow the exact `useTable`/`Table`/`Pagination` pattern established in Phase 3 — lint passed clean on the first try this time, confirming the pattern is now genuinely reusable rather than one-off.
- Manager assignment dropdown pulls from the Users list (`userService.listUsers`).

**Performance (opportunistic, not originally scoped here)**
- `vite build` started warning about a >500kB chunk once Branches pushed the bundle over the threshold. Converted every route-level page import in `AppRouter.jsx` to `React.lazy()` wrapped in a single `Suspense`, using the same spinner as `ProtectedRoute`'s loading state. Largest chunk dropped from 507kB to 307kB, with every page now its own small on-demand chunk. This is the pattern all future phases' routes should follow — established now while there are only ~13 routes, rather than retrofitting it across 40+ later.

**Verification**
- Backend dry-run: both branch endpoints correctly 401 pre-auth.
- Frontend: Playwright with mocked API — BranchList shows resolved manager names and active/inactive badges, BranchForm's manager dropdown populates correctly, lazy-loaded chunks load without errors. Zero console errors.

## Phase 4 — Roles & Permissions (Role CRUD + Permission Matrix)

Completes the RBAC module — the permission-check middleware and `usePermission` hook already shipped in Phase 2 when Company Settings needed them first.

**Backend**
- `role.repository.js`: full CRUD plus `countUsersWithRole` (blocks deletion while any user still holds the role). `permission.repository.js`: `replaceForRole` wraps the delete+bulk-insert in a real transaction (rollback on failure) rather than two unguarded statements.
- Business rules in `role.service.js`: system roles (`is_system=true`) cannot be renamed or deleted regardless of caller permissions — this is a code-level guarantee, not just a missing DELETE button; role name uniqueness checked on both create and update.
- `middlewares/authorize.js`'s permission cache is invalidated (`invalidatePermissionCache(roleId)`) whenever a role's permission set changes, so updates take effect immediately instead of waiting out the 60-second cache window.
- Routes: `GET /roles` stays public-to-any-authenticated-user (unchanged from Phase 3, used by dropdowns elsewhere); everything else (`POST/PUT/DELETE /roles`, `GET/PUT /roles/:id/permissions`, `GET /roles/permissions/catalog`) requires the matching `roles.*` permission.

**Frontend**
- `RoleList.jsx`: table + create/edit modal (2 fields — name, description); delete action hidden entirely for system roles rather than shown-then-rejected.
- `PermissionMatrix.jsx`: a genuine matrix — permissions grouped by module as rows, roles as columns, checkbox per cell. Fetches every role's current permission set in parallel on load, tracks edits locally, and on Save diffs against the original per role so only roles that actually changed get a `PUT` call (not all of them). The Super Administrator column is rendered checked-and-disabled — editable Super Admin permissions risk locking out the only admin account with no recovery path, so it's structurally prevented rather than just discouraged.
- Added "Roles" to the Sidebar between Users and Customers (the spec's sidebar list doesn't itemize it separately, but it needs a way in — nested/grouped sidebar sections aren't built yet, so it's a flat top-level entry for now, matching how Settings was handled in Phase 2).

**Verification**
- Backend dry-run: role + permission-catalog endpoints correctly 401 before authentication.
- Frontend: Playwright with mocked API responses (same technique as Phase 3, still no live DB in this session) — confirmed RoleList's System/Custom badges and conditional delete button, the New Role modal, and the full PermissionMatrix grid rendering grouped checkboxes with the locked Super Admin column. Zero console errors.

## Phase 3 — User Management

**Backend**
- Extended `user.repository.js` (previously auth-only) with `findAll` (paginated, searchable across name/email/username/phone, filterable by role/branch/status), `findConflict` (uniqueness check across email/username/phone in one query, excludes self on edit), `update`, `updateStatus`, `updateAvatarPath`, `softDelete`, and `getBranchIds`/`setBranches` for the `user_branches` many-to-many.
- `user.service.js` enforces two self-protection rules not in the spec but necessary given there's exactly one Super Admin at bootstrap: you cannot change your own status or delete your own account via this endpoint (prevents accidental self-lockout with no other admin to recover).
- List endpoints now return `data: { items, meta }` (`meta` = `{ page, limit, total, totalPages }`) — establishes the pagination envelope convention every future list endpoint follows.
- Minimal read-only pull-forwards (list-only, no create/edit): `GET /branches` and `GET /roles`, needed for the User form's dropdowns. Full Branch CRUD (Phase 5) and Role CRUD/Permission Matrix (Phase 4) are unaffected — these are just lookups.

**Frontend — new reusable infrastructure** (every future list page reuses this instead of duplicating table logic):
- `useTable(fetchFn)`: pagination + debounced search + filters + sort state, wired to any `fetchFn(params) -> { items, meta }`. Hit React 19's stricter `react-hooks/set-state-in-effect` lint rule on two textbook-standard patterns (fetching data in an effect, resetting to page 1 when search/filters change); resolved with targeted, documented disables rather than contorting the code, after confirming both patterns are the React docs' own recommended approach.
- `components/common/`: `Table` (sortable headers, loading/empty states), `Pagination`, `SearchInput` (debounced), `Modal` (Framer Motion enter/exit, portal-rendered, Escape/backdrop close), `ConfirmDialog` (built on `Modal`, loading-aware confirm button).
- `usePermission`-gated row actions (edit/suspend/delete) — hidden client-side for UX, independently enforced server-side per-route.

**Verification**
- Backend dry-run: `/users`, `/branches`, `/roles` all correctly return 401 before authentication, without touching the DB layer.
- Frontend: since no live database is available in this session, used Playwright's request interception to mock `/auth/refresh`, `/company`, `/users`, `/roles`, `/branches` with realistic JSON matching the real API contract — this renders the *actual* React components (real `MainLayout`, real `Table`, real form validation) against fake data rather than testing nothing. Confirmed: UserList table with status badges and pagination, UserForm create with populated role/branch dropdowns, UserForm edit with correctly pre-filled fields and multi-select branch state. Zero uncaught JS errors.

## Phase 2 — Company Settings

**RBAC pulled forward from Phase 4** (only the piece Company Settings actually needed):
- `repositories/permission.repository.js` + `middlewares/authorize(permissionCode)`: DB-driven permission check with a 60-second in-memory per-role cache (avoids a query on every request while staying correct within a short staleness window). `invalidatePermissionCache()` exported for Phase 4's Role Management UI to call when permissions change.
- `/auth/login`, `/auth/refresh`, `/auth/me` now all return `permissions: string[]` for the current user's role (previously just the sanitized user row).
- Frontend: `AuthContext.hasPermission(code)` + a thin `usePermission(code)` hook.
- Explicitly **not** pulled forward: Role CRUD endpoints/UI and the Permission Matrix editor — those remain Phase 4 scope. `docs/TODO.md` updated to show Phase 4's remaining scope accurately rather than re-listing already-shipped items.

**Backend**
- `company_settings` is a single-row table — `company.service.js` does get-or-insert-then-update (no seed row, since a fresh business's profile shouldn't be pre-filled with placeholder data).
- `middlewares/upload.js`: a reusable Multer factory (`createUploader({ subfolder, allowedMimeTypes, maxSizeMb })`) — the logo endpoint is the first consumer; product images, avatars and receipts will reuse it in later phases instead of duplicating Multer config.
- Logo upload validates MIME type + 2MB limit, stores under `backend/uploads/logo/`, deletes the previous logo file on replace (non-fatal if already gone), and is served via `express.static('/uploads')`.
- **`GET /company` is deliberately public** (no `authenticate`) — the Login page needs the name/logo before a session exists. Safe here because this is a single-tenant system (one company's own public-facing profile, not another tenant's private data); `PUT`/`POST /company/logo` still require `authenticate` + `authorize('company.manage')`.

**Frontend**
- New `CompanyContext`/`useCompany()` (mirrors the `AuthContext` pattern) fetches the company profile once at the app root and is consumed by `AuthLayout` (login page brand), `Sidebar` (logo replaces the "Clix" text mark when set), and `Navbar` (a small logo shown only ≤768px, since the sidebar already carries the brand on desktop — added specifically for when the sidebar is off-screen on mobile).
- `CompanySettings.jsx`: full form matching every field in `MASTER_PROMPT.md`'s Module 1, immediate-upload logo picker with preview, and a read-only mode (all fields disabled, no save/upload controls) for users without `company.manage` — the frontend gate is UX only, the backend still enforces it independently per the spec's "never rely only on frontend hiding buttons" rule.
- Routed at `/settings/company`; Sidebar's "Settings" link now points there (temporary — Phase 23 will turn `/settings` into a hub with Company as one tab among several).

**Verification**
- Backend dry-run (still no live DB): confirmed `GET /company` is reachable pre-auth and fails safely (generic 500, DB unreachable) rather than 404/leaking a DB error; confirmed `PUT /company` correctly returns 401 before authentication is checked.
- Caught and fixed a real bug during dry-run testing: a stale backend process from earlier manual testing survived a `pkill -f` (unreliable against Windows-spawned node processes from Git Bash) and was silently serving pre-Phase-2 routes, producing misleading 404s. Resolved by enumerating and force-stopping node processes via PowerShell `Get-CimInstance`/`Stop-Process` instead of `pkill`, then re-verified cleanly.
- Frontend verified in-browser: Login page renders correctly with `CompanyProvider` added (falls back to the "Clix" text mark when no company row exists yet, exactly as designed), zero uncaught JS errors.

## Phase 1 — Authentication

**Backend**
- Built the full auth stack following the layered architecture: `repositories/` (user, role, session, refreshToken, passwordReset, activityLog — pure SQL, no logic) → `services/auth.service.js` (all business rules) → `controllers/auth.controller.js` (thin, cookie handling only) → `routes/auth.routes.js`.
- JWT design: short-lived access token (15m, in-memory on the client) + long-lived refresh token (JWT signed with a separate secret, 30d with "remember me" / 1d without), stored **stateful** — hashed (SHA-256) and persisted in `refresh_tokens`/`sessions` so it can be revoked, combining stateless verification with DB-backed revocation and device tracking.
- Refresh token delivered as an **httpOnly, `sameSite=lax` cookie** scoped to `/api/v1/auth`; `secure` flag tied to `NODE_ENV=production`. Refresh rotation on every use (old token revoked, new one issued on the same session).
- Account lockout: 5 failed attempts within 15 minutes → 15-minute lock, via a single atomic `UPDATE ... IF(...)` to avoid a race between concurrent failed attempts.
- Forgot/reset password: random 32-byte token (hashed before storage, 30-minute expiry), always returns a generic success message regardless of whether the email exists (prevents user enumeration), and revokes all of the user's sessions on a successful reset (forces re-login everywhere).
- `email.service.js` never throws — if SMTP isn't configured (no `SMTP_HOST`), it logs to `email_logs` with a clear reason and the request still succeeds, so the auth flow works end-to-end even before production email is configured.
- Centralized `authenticate` middleware (JWT verify only); the DB-driven permission-check middleware is deliberately deferred to Phase 4 (Roles & Permissions) per `docs/TODO.md` — Phase 1's endpoints only need "authenticated or not," not granular permission codes.
- **`npm run seed:admin`** (`backend/database/seeders/create-admin.js`): interactive (or env-var-driven) CLI to create the first Super Administrator. No credentials are hardcoded anywhere — this solves the bootstrap problem left open in Phase 0 (no default admin was seeded in SQL, by design).

**Frontend**
- `src/services/apiClient.js`: Axios instance with an automatic-refresh interceptor (401 → single in-flight `/auth/refresh` call, shared across concurrent failed requests → retry once → on failure, clear state and redirect to Session Expired).
- `vite.config.js` now proxies `/api` to `http://localhost:4000` in dev, and `VITE_API_URL` defaults to the relative `/api/v1` — keeps frontend and backend same-origin (dev proxy, prod via Nginx) so the httpOnly cookie works without needing `SameSite=None`+HTTPS in local dev.
- `AuthContext` (provider in `AuthContext.jsx`, context object split into `authContextInstance.js` to satisfy React Fast Refresh's one-export-per-file rule) attempts a silent `/auth/refresh` on mount to restore a session across page reloads.
- `ProtectedRoute` gates the authenticated app shell; unauthenticated visitors are redirected to `/login` with the originally-requested path preserved for post-login redirect.
- Built `Login`, `ForgotPassword`, `ResetPassword` (reads `?token=`, client-side password-policy validation mirroring the backend), and `SessionExpired` pages — all using React Hook Form, the shared `forms.css`/`buttons.css` design system, loading-disabled submit buttons, and inline field + form-level error handling.
- Wired the real `logout()` into the Sidebar's Logout button and real user name/initials/branch into the Navbar (previously static placeholders from Phase 0).

**Verification**
- Backend verified without a live database: syntax-checked, dry-imported, then a persistent DB-less instance was booted to confirm the health check, express-validator error shapes, and the `authenticate` middleware's 401 responses (structured JSON, no stack trace leaked — confirmed via Winston log vs. HTTP response comparison).
- Frontend verified in a real browser (headless Edge via Playwright) against that same DB-less backend: unauthenticated root correctly redirects to `/login`; client-side validation fires; a login attempt correctly surfaces a safe generic error when the backend's DB call fails; Forgot Password, Reset-Password-without-token, and Session Expired pages all render and navigate correctly; zero uncaught JS errors (only expected 401/500 network log entries from the deliberately DB-less backend).
- **Not verified**: a full live login round-trip against a real MySQL instance, since production DB credentials are intentionally out of this session's scope (owner-managed). The project owner should run `npm run seed:admin` after applying the schema and do a first real login as a final smoke test.

## Phase 0 — Project Setup

**Planning**
- Added `docs/PROJECT_PLAN.md`, `docs/TODO.md`, `docs/DATABASE_PLAN.md`, `docs/API_PLAN.md`, `docs/FOLDER_STRUCTURE.md` capturing architecture decisions, the phase plan, and the full schema/API contract.
- Resolved four spec ambiguities with the user: gold/black brand palette is canonical (not the navy/green corporate palette also present in `MASTER_PROMPT.md`); products are a shared catalog with per-branch `inventory` rows (not duplicated per branch); Chart.js + react-chartjs-2 added for dashboard charts (spec required charts but named no library); `html5-qrcode` added for in-browser camera QR scanning in POS.

**Frontend**
- Installed the approved dependency set: `react-router-dom`, `axios`, `react-hook-form`, `framer-motion`, `react-icons`, `chart.js`, `react-chartjs-2`, `html5-qrcode`.
- Built the full `src/` folder structure per `docs/FOLDER_STRUCTURE.md`.
- Built the design system: `variables.css`, `colors.css` (gold/black brand palette), `typography.css` (Poppins), `spacing.css`, `buttons.css`, `forms.css`, `tables.css`, `cards.css`, `layout.css`, `animations.css`, `responsive.css`, `utilities.css`, `theme.css`.
- Built layout shells: `AuthLayout`, `MainLayout` (with `Sidebar` — full nav menu, collapsible — and `Navbar` — branch selector, search, notifications, user menu, live clock), `ErrorLayout`.
- Wired `AppRouter` with placeholder `Login` and `Dashboard` pages and a `NotFound404` page; verified all three render correctly with zero console errors via a headless-browser check (screenshots reviewed).
- Replaced the default Vite scaffold (`App.jsx`, `App.css`, `README.md`, `index.html` title/meta) and removed now-unused scaffold assets (`react.svg`, `vite.svg`, `hero.png`, `public/icons.svg`).

**Backend**
- Scaffolded `backend/` as a sibling to the existing frontend root (intentional deviation from the spec's `client/`+`backend/` example — the Vite app already lives at the repo root and the spec forbids relocating it; documented in `docs/FOLDER_STRUCTURE.md` §1).
- Installed runtime dependencies (express, mysql2, jsonwebtoken, bcrypt, express-validator, helmet, express-rate-limit, cors, cookie-parser, multer, qrcode, pdfkit, exceljs, json2csv, node-cron, nodemailer, dotenv, winston) and dev dependencies (nodemon, eslint).
- Built the Express app skeleton: `config/` (env validation, MySQL pool, CORS, winston logger), `middlewares/` (centralized error handler that never leaks stack traces or raw SQL errors, rate limiter), `utils/` (`apiResponse`, `apiError`, `asyncHandler`), `routes/index.js` with a `/api/v1/health` check.
- Verified the full request pipeline (Helmet → CORS → rate limiter → routing → error handling → response envelope) end-to-end with a live request against an ephemeral port, using only in-process dummy environment variables — no `.env` file was created and no database was touched.

**Database**
- Wrote the complete schema as 10 numbered migrations (`backend/database/migrations/001`–`010`, 42 tables) covering every module in `docs/DATABASE_PLAN.md`: auth/RBAC, branches, company/system settings, sessions/tokens, catalog & inventory (with the immutable `inventory_movements` ledger), purchases & suppliers, sales/POS/returns, stock transfers, expenses, car wash, notifications/activity/audit logs.
- Resolved the `branches`↔`users` circular foreign key (branch manager vs. user's home branch) by creating `branches` without the manager FK first, then `users`, then adding the deferred `ALTER TABLE` constraints.
- Added a combined `backend/database/schema.sql` (concatenation of all migrations) and `backend/database/README.md` documenting apply order and the reasoning behind schema decisions.
- Seeded safe, static reference data only: the 4 system roles, the full permission catalog, a role→permission mapping derived from `MASTER_PROMPT.md`'s per-module `PERMISSIONS` sections, default expense categories, and default car wash services. Deliberately did **not** seed a default Super Admin account (see `backend/database/README.md` for the security reasoning) — the first admin is created interactively once Phase 1 (Authentication) ships.
- Statically verified all 42 tables' foreign keys resolve to already-declared tables (no forward references) and that every migration file is syntactically balanced — without requiring a live database connection, since production database provisioning is being handled directly by the project owner on their Contabo MySQL server.

**Refinements to `docs/DATABASE_PLAN.md`**
- Clarified that pure join tables (`role_permissions`, `user_branches`) intentionally omit `updated_by`/`updated_at`/`deleted_at` (insert/delete only, never updated) — a refinement made while writing the actual DDL.
