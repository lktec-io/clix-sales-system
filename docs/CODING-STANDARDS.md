# Coding Standards

Conventions this codebase follows consistently across all 23 feature phases. Follow these for any future change — consistency is more valuable here than any individual preference.

## Backend

### Layering — never skip a layer

`Router → Validator → authenticate → authorize(code) → Controller → Service → Repository → Database`. A controller never contains a SQL query. A repository never contains business logic (branch-scope checks, cross-module effects, discount math). A service never touches `req`/`res` directly — it receives plain data and a user/actor, and returns plain data or throws `ApiError`.

### File naming and shape

- One repository, one service, one controller, one validator, one route file per module — `<module>.repository.js`, `<module>.service.js`, etc. Multi-word modules use camelCase (`expenseCategory.repository.js`, `systemSettings.service.js`).
- Controllers are `asyncHandler(async (req, res) => { ... })` — never a bare `async` route handler (that would silently swallow rejected promises instead of reaching the error handler).
- Every service function that mutates data takes `(data, actorId, user?)` — `actorId` for `created_by`/audit trails, `user` when a branch-scope or permission check is needed.

### SQL

- Every query is parameterized (`?` placeholders). Never string-interpolate a value into a query — only structural fragments built entirely from trusted, hardcoded conditions (a `WHERE` clause assembled from `if (filter) conditions.push('x = ?')`) may be interpolated as SQL *text*, and only because the values themselves still go through the params array.
- `branchFilter(column, branchIds)` is the standard shape for applying branch scope to a query — see any repository with a `findAll()` for the pattern; copy it rather than inventing a new one.
- List queries always return `{ rows, total }` (and sometimes an aggregate like `totalAmount`) — the service layer turns that into the standard `{ items, meta }` pagination envelope.

### Transactions

If an operation writes to more than one table and any of those writes represents money or stock moving, wrap it: `pool.getConnection()` → `beginTransaction()` → every write on `connection` (not `pool`) → `commit()` → `release()` in `finally`, `rollback()` in `catch`. Side effects that shouldn't be undone by a later failure (activity logs, notifications) always happen *after* `commit()` succeeds — never inside the transaction.

### Errors

Throw `new ApiError(status, message)` for anything the client should see a specific reason for (400/403/404/409/422). Let unexpected errors propagate uncaught — the global error handler turns them into a safe generic 500. Never `console.log` an error and continue silently in a service; either handle it meaningfully or let it throw.

### Validators

`express-validator` chains, exported as `<action>Validator` arrays, consumed by `validateRequest` middleware in the route file. Reuse `isStrongPassword`/`PASSWORD_POLICY_MESSAGE` (`utils/passwordPolicy.js`) for every password field rather than re-deriving the regex.

## Frontend

### Page shape

- **List + modal**: for simple CRUD (Categories, Brands, Customers, Suppliers, Expenses) — one page, `useTable()` for pagination/search/filters, a `Modal` with a React Hook Form for create/edit, `ConfirmDialog` for destructive/state-changing confirmations.
- **List + Form + Detail**: for anything with enough state or a multi-step workflow to warrant its own page (Purchases, Transfers, POS/Sales, Returns) — a dedicated `/new` route for creation, a `/:id` detail route, list page links to both.
- Every list page's toolbar: `SearchInput` on the left, filter `<select>`/date inputs on the right, wrapped in `flex flex-wrap items-center gap-3` (not bare `flex` — filters must wrap on narrow viewports, not overflow).

### Data fetching

`useTable(fetchFn, options?)` is the standard hook for any paginated list — don't hand-roll pagination state. For a one-off fetch (a detail page, a dropdown's option list), a plain `useEffect` calling the service function directly is correct and matches the rest of the codebase; don't reach for a data-fetching library for this.

`react-hooks/set-state-in-effect` will flag a data-fetching effect that calls `setState` — this is expected for the standard `useEffect(() => { fetchThing().then(setState) }, [])` pattern (a documented, correct React pattern per react.dev). Suppress it with a targeted comment **on the line that triggers the fetch**, not the `useEffect(() => {` line itself, with a one-line reason:

```js
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- <why this is standard data-fetching, not derived state>
  loadThing();
}, [dep]);
```

### Forms

React Hook Form everywhere. `watch()` triggers a `react-hooks/incompatible-library` *warning* (not error) from the React Compiler — this is expected and accepted, not something to work around. For a dependency array that needs a derived value from `watch()`, extract it to a variable first rather than inlining a complex expression (`JSON.stringify(x)` etc.) directly in the array — the linter rejects complex expressions there.

### Permissions in the UI

`usePermission(code)` gates buttons/sections. This is a UX convenience, never the actual security boundary (see [SECURITY.md](SECURITY.md)) — every action it gates must also be independently enforced server-side.

### Styling

Pure CSS, no framework. One file per page under `src/styles/pages/`, imported directly in that page's component. Shared/reusable patterns (buttons, cards, forms, tables, badges) live in the top-level `src/styles/*.css` files — check there before writing a new class that might already exist (`.badge-success/-warning/-danger/-info/-neutral`, `.form-checkbox`, `.flex-wrap`, etc.). Use the CSS custom properties from `variables.css`/`colors.css`/`spacing.css`/`typography.css` — never a hardcoded hex color or pixel spacing value.

### Route-level code splitting

Every page is `const Page = lazy(() => import('../pages/.../Page'))` in `AppRouter.jsx`, inside the single `<Suspense>` boundary. Every new page follows this without exception, regardless of how small — consistency here matters more than the marginal savings on any one small page.

## General

- **Comments explain *why*, not *what*.** A comment referencing a hidden constraint, a subtle invariant, or the reasoning behind a non-obvious choice is worth writing. A comment restating what the next line of code already says is not.
- **No dead code, no unused dependencies.** If a package is installed but nothing imports it, remove it (see the Phase 24 removal of `exceljs`/`json2csv` once CSV export shipped as a client-side utility instead) — don't leave it "for later" with no plan attached.
- **Match existing patterns before introducing a new one.** If a very similar module already exists (e.g. building Brands after Categories, or Transfers after Purchases established the transactional pattern), read it first and follow its shape rather than solving the same problem a different way.
