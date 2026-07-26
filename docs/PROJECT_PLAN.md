# Clix Sales System — Project Plan

Source of truth: `prompt/MASTER_PROMPT.md`. This document is the architect-level plan produced from analyzing that spec against the current repository state. No application code has been written yet — this is the pre-implementation deliverable requested before Phase 1 begins.

---

## 1. Current State Assessment

The repository is the **untouched default `npm create vite` React template**:

- `package.json` only lists `react` + `react-dom` as dependencies and `vite`/`eslint` as dev dependencies. None of the mandated libraries (`react-router-dom`, `axios`, `react-hook-form`, `framer-motion`, `react-icons`) are installed.
- `src/App.jsx`, `src/App.css`, `README.md` are all scaffold defaults (Vite/React starter content, counter button, "Explore Vite" links).
- No `backend/` directory exists at all — no Express app, no `package.json`, no `.env`.
- No `docs/` directory existed before this plan.
- No git repository has been initialized.
- No database, migrations, or seeders exist.

**Conclusion:** there is nothing to repair, deduplicate, or refactor. Every module in the master prompt is **Not Started**. The "detect broken/dead/duplicated code" analysis step therefore has no findings — the codebase is a clean slate.

---

## 2. Architecture Decisions Locked In

The master prompt contained several ambiguities/conflicts that would have caused rework if implemented as-is. These were resolved with the user before planning began:

| Decision | Resolution | Why |
|---|---|---|
| **Color palette conflict** — the doc defines a gold/black "Brand Identity" palette *and* a separate navy/green "Color Palette" section inspired by generic ERP products | **Gold & Black (Brand Identity)** is canonical: Primary Gold `#C8A56A`, Dark Gold `#A88447`, Light Gold `#D9BC84`, Primary Black `#111111`, Dark Gray `#1F2937`, Light Gray `#F5F5F5`, Background `#FAFAFA`, White `#FFFFFF`, Border `#E5E7EB`, Success `#16A34A`, Warning `#F59E0B`, Danger `#DC2626`, Info `#2563EB` | Tied explicitly to the company logo; the navy/green section reads as generic inspiration boilerplate, not brand-specific |
| **Product ↔ Branch relationship** — spec lists both `products` and `inventory` as separate tables but also shows a "Branch" field directly on Product | **Shared catalog + per-branch inventory rows.** One `products` row per SKU (one code, one QR). Stock is tracked per branch in `inventory` (`product_id` + `branch_id`) | Matches the DB module list having both tables; makes transfers a natural inventory-row update instead of a product copy; avoids duplicate codes/QRs per branch |
| **Charting library** — dashboard requires 8+ chart types but the approved frontend library list has none | **Chart.js + react-chartjs-2** added to the approved dependency list | Mature, canvas-based, broad chart-type coverage for trend/bar/pie/doughnut needs |
| **QR/Barcode scanning in POS** — "QR Scan" implies camera input, which needs a library outside the approved list | **In-browser camera scanning now**, using `html5-qrcode` | User chose full camera-scan capability for Phase 1 rather than deferring to physical scanner hardware |

These four additions (`react-router-dom`, `axios`, `react-hook-form`, `framer-motion`, `react-icons`, `chart.js`, `react-chartjs-2`, `html5-qrcode`) are the **complete** frontend dependency list. No other UI/CSS frameworks are permitted per the spec (no Tailwind/Bootstrap/MUI/Chakra/Ant/Bulma/Foundation).

---

## 3. Structural Deviation from the Spec's Example Folder Layout

The master prompt's example shows `client/` and `backend/` as sibling folders. However, the Vite app **already exists at the repository root** (`src/`, `public/`, `index.html`, `vite.config.js`, `package.json`) — and the spec explicitly forbids re-initializing or relocating the existing project.

**Resolution:** the frontend stays at the repository root exactly as it exists today. `backend/` is added as a new sibling directory. `docs/` holds all planning and living documentation. This satisfies "layered architecture" and "never move files without reason" simultaneously. See `FOLDER_STRUCTURE.md` for the full tree.

---

## 4. Additional Gaps Identified in the Spec (Recommendations, Not Blocking)

These didn't require a stop-the-line question, but need a documented default so implementation doesn't stall later. Flag any of these to override before the relevant phase starts.

| Area | Gap | Recommended Default |
|---|---|---|
| Currency & locale | Never explicitly named, but TIN/VRN + M-Pesa/Airtel Money strongly imply Tanzania | Default currency **TZS**, stored as a `company_settings.currency` value (not hardcoded), locale `en-TZ` |
| Tax/VAT | "Taxes" mentioned in Settings but no rate/rule | `system_settings` holds a configurable VAT rate (default 18% TZ standard rate); tax is opt-in per sale line, off by default until Settings module defines it |
| Mobile money payments | M-Pesa/Airtel Money listed as payment methods with no gateway/API mentioned | Treated as **manually recorded** payments in Phase 3 (cashier enters amount + reference number); real-time gateway webhook integration is future-ready, not in scope |
| Document numbering scope | `SAL-2026-000001` style examples don't show branch code — unclear if sequences are global or per-branch | **Global sequence per document type per year**, generated via a single reusable `document_sequences` table + row-locking transaction (avoids collisions across concurrent POS terminals) |
| Access/refresh token storage | Not specified where JWTs live client-side | Refresh token in an **httpOnly, Secure, SameSite=Strict cookie**; access token held in memory (React context), not `localStorage`, to reduce XSS exposure |
| Password policy specifics | "Minimum length… strong complexity" without numbers | Default: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 symbol; bcrypt cost factor 12 |
| Account lockout threshold | "Lock after repeated failed attempts" without a number | 5 failed attempts within 15 minutes → 15-minute lock, recorded on `users.failed_login_attempts` / `locked_until` |
| PDF generation approach | Spec says "PDF Generator" with no library named | `pdfkit` (programmatic, low memory) for receipts/labels; a lightweight HTML-to-PDF path only if a report layout proves too complex for programmatic generation — avoids running headless Chrome (Puppeteer) on a small VPS |
| Receipt printing | No printer protocol specified | Browser `window.print()` with a dedicated print stylesheet sized for 80mm thermal paper; ESC/POS direct printer integration is out of scope |
| Global search | "Fast searching required" with no engine named | MySQL `LIKE`/`FULLTEXT` indexes on searchable columns; Elasticsearch is unnecessary at this scale |
| Multi-branch managers | Users table shows one `branch_id`, but business rules say "Managers see **assigned branches**" (plural) | Add a `user_branches` join table for many-to-many manager assignments; `users.branch_id` remains the user's *primary/default* branch |
| Notifications delivery | Read/unread required, no transport specified | Polling-based (client fetches `/notifications` periodically) for Phase 1; WebSocket push is future-ready, not required now |

---

## 5. Layered Architecture (applies to every backend feature)

```
Client (React)
   ↓
Router (Express route file — thin, no logic)
   ↓
Validation (express-validator chain)
   ↓
Authentication Middleware (JWT verify)
   ↓
Authorization Middleware (permission check against DB-driven role_permissions)
   ↓
Controller (coordinates request/response only)
   ↓
Service (ALL business logic lives here — discounts, stock rules, transaction orchestration)
   ↓
Repository (ALL SQL lives here — no query ever appears in a controller or service)
   ↓
MySQL (transactions wrap every financial/inventory-affecting write)
```

Rule of thumb used throughout: **routes are dumb, controllers are thin, services own the rules, repositories own the SQL.**

---

## 6. Project Health Scorecard

Since no application code exists, numeric quality scores would be meaningless noise. Status instead:

| Dimension | Status |
|---|---|
| Architecture | Planned (this document + `FOLDER_STRUCTURE.md`), not yet implemented |
| Security | Planned (JWT/RBAC/validation strategy defined below), not yet implemented |
| Maintainability | N/A — no code written |
| Performance | N/A — no code written |
| Responsiveness | N/A — no UI built |
| Accessibility | N/A — no UI built |
| Code Quality | N/A — repo is the default Vite scaffold |
| Documentation | Spec is thorough (5,972-line master prompt); project docs now exist (this set) but `README.md` is still the Vite default and needs replacing before Phase 1 closes |
| Deployment Readiness | 0% — no `.env.example`, no PM2 config, no Nginx config, no CI |

**Completed Modules:** none.
**Partially Completed Modules:** none.
**Not Started Modules:** all 26 items in the Implementation Order (Section 7).

---

## 7. Phase Plan (mirrors the master prompt's mandated implementation order — do not reorder)

| # | Phase | Scope Summary | Depends On |
|---|---|---|---|
| 0 | Project Setup | Install approved dependencies (frontend + backend), scaffold `backend/`, set up MySQL connection, ESLint/Prettier for backend, `.env.example`, base Express app with Helmet/CORS/rate-limiting, base router/layout skeleton in React | — |
| 1 | Authentication | Login, JWT access+refresh, bcrypt hashing, password reset via email, remember me, session/device tracking, logout (current/all devices), account lockout | 0 |
| 2 | Company Settings | Company profile CRUD (Super Admin only), logo upload, propagate logo to receipts/reports/dashboard | 1 |
| 3 | User Management | Users CRUD, activate/suspend/lock/soft-delete, role assignment, branch assignment | 1, 4 |
| 4 | Roles & Permissions | Dynamic roles table, permissions table, role_permissions join, permission-check middleware, frontend permission gating | 1 |
| 5 | Branches | Branch CRUD, manager assignment, `user_branches` for multi-branch managers, branch isolation rules | 1 |
| 6 | Dashboard | KPI cards, Chart.js charts, recent activity timeline, quick actions, notification panel widget, global search | 2–5 |
| 7 | Categories | Category CRUD, uniqueness, delete-blocked-if-products-exist | 4 |
| 8 | Brands | Brand CRUD, same rules as Categories | 4 |
| 9 | Products | Product CRUD, image upload, auto product-code generation, buying/selling price rules | 7, 8 |
| 10 | Inventory | Per-branch stock, stock movements ledger, adjustments with reasons, low/out-of-stock detection | 9 |
| 11 | QR Codes | Auto QR generation on product create, PNG output, download/print/regenerate, `qr_codes` history | 9 |
| 12 | Label Printing | Single + bulk label printing, multiple paper sizes | 11 |
| 13 | Suppliers | Supplier CRUD, purchase history view, deactivate | 4 |
| 14 | Purchases | Purchase orders, receiving stock (increments inventory + movement), supplier balance tracking, purchase numbering | 10, 13 |
| 15 | Stock Transfers | Transfer request → approval workflow, dual inventory update (source/destination), transfer numbering | 10 |
| 16 | Customers | Customer CRUD, customer types, purchase/return history | 4 |
| 17 | POS | Cart, camera QR scan (`html5-qrcode`), discounts (permission-gated), mixed payments, checkout transaction, receipt generation/printing | 10, 16 |
| 18 | Returns | Return workflow against original sale, inventory restoration, refund tracking, return numbering | 17 |
| 19 | Expenses | Expense CRUD, categories, branch scoping, profit-report impact | 4 |
| 20 | Car Wash | Vehicle registration, service catalog, transactions, payment, revenue reporting | 4 |
| 21 | Reports | Centralized Reports Center across all modules, filters, Print/PDF/Excel/CSV export, dashboard KPI parity | 9–20 |
| 22 | Notifications | Notification generation on key events, read/unread, mark-all-read, polling delivery | 6–21 |
| 23 | Settings | System settings (currency, tax, receipt footer, email config, backup) | 2 |
| 24 | Final Testing | Full regression across backend/frontend/API/DB/permissions/responsiveness/printing/reports/security | all |
| 25 | Deployment | Contabo VPS provisioning, Nginx, PM2, SSL, backup/restore procedure, `DEPLOYMENT.md` | 24 |

Each phase closes only when its Quality Check (as defined per-phase in the master prompt) passes: build green, lint green, TODO updated, CHANGELOG updated.

---

## 8. Definition of Done (applies to every feature, not just phase-end)

A feature is not complete until: backend done, frontend done, validation added, permissions enforced (both frontend hide *and* backend reject), documentation updated, `TODO.md` checked off, `CHANGELOG.md` entry written, responsive on desktop/laptop/tablet/mobile, `npm run build` passes, lint passes, zero console errors, zero runtime errors.

---

## 9. Risks & Watch Items

- **Sequence collisions**: concurrent POS terminals generating sale/purchase/transfer numbers simultaneously must use `SELECT ... FOR UPDATE` inside a transaction on `document_sequences`, or duplicate numbers are possible under load.
- **Financial atomicity**: sale/purchase/return/transfer/expense writes touch 3+ tables each (header, lines, inventory movement) — every one of these must be a single MySQL transaction with rollback on any failure, per the spec's explicit rule.
- **VPS resource ceiling**: Contabo VPS tiers are typically modest (2–4 vCPU / 4–8GB RAM). Avoid Puppeteer/headless-Chrome-based PDF generation for this reason — `pdfkit` is the safer default.
- **Camera QR scanning on desktop cashier stations**: `html5-qrcode` requires `getUserMedia` (HTTPS or localhost) and a webcam. Since the production URL is HTTPS (`https://sales.clixworks.co.tz`), this is fine in production, but local dev over plain HTTP will need `localhost` (browsers treat it as a secure context) — no extra config needed as long as dev is accessed via `localhost`, not a LAN IP.

---

## 10. Immediate Next Step

Once this plan, `TODO.md`, `DATABASE_PLAN.md`, `API_PLAN.md`, and `FOLDER_STRUCTURE.md` are approved, Phase 0 (Project Setup) begins: installing dependencies, scaffolding `backend/`, and replacing the default Vite `README.md`/`App.jsx` scaffold content. No code will be written before that approval.
