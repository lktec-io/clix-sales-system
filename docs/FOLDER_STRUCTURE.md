# Clix Sales System — Folder Structure

## Deviation from the master prompt's example layout

`prompt/MASTER_PROMPT.md` shows `client/` and `backend/` as sibling folders. The Vite frontend **already exists at the repository root** (`src/`, `public/`, `index.html`, `vite.config.js`, `package.json`), and the spec explicitly forbids re-initializing or relocating it. So:

- The frontend stays at the repository root, unchanged in location.
- `backend/` is added as a new sibling directory.
- `docs/` holds all planning + living documentation.

This still delivers the required separation and layered architecture; it just avoids an unnecessary `client/` nesting move.

---

## 1. Repository Root

```
clix-sales-system/
├── docs/                          # PROJECT_PLAN, TODO, CHANGELOG, DATABASE_PLAN, API_PLAN,
│                                   # FOLDER_STRUCTURE, ARCHITECTURE, DATABASE, API,
│                                   # DEPLOYMENT, SECURITY, TESTING, CODING-STANDARDS
├── prompt/                        # existing spec source (MASTER_PROMPT.md + split parts)
├── public/                        # existing — favicon.svg, icons.svg
├── src/                           # existing Vite frontend root — see §2
├── backend/                       # new — Express API — see §3
├── .env.example                   # frontend env template (VITE_API_URL etc.)
├── .gitignore
├── eslint.config.js               # existing
├── index.html                     # existing
├── package.json                   # existing (frontend)
├── vite.config.js                 # existing
└── README.md                      # to be replaced (currently default Vite scaffold)
```

---

## 2. Frontend — `src/`

```
src/
├── assets/
│   ├── images/                    # generic imagery
│   └── logo/                      # company logo variants (full, mark-only, white, favicon source)
│
├── components/
│   ├── common/                    # Button, Card, Modal, Table, Pagination, Badge,
│   │                               # StatusIndicator, Alert, Spinner, Skeleton, EmptyState,
│   │                               # ErrorState, Dropdown, SearchInput, DateRangePicker,
│   │                               # FileUpload, ConfirmDialog, PrintPreview, QRScanner
│   ├── layout/                    # Sidebar, Navbar, Footer
│   ├── dashboard/                 # KPICard, ChartCard, ActivityTimeline, QuickActions,
│   │                               # NotificationPanel
│   ├── charts/                    # LineChart, BarChart, PieChart, DoughnutChart
│   │                               # (thin wrappers around react-chartjs-2, themed to variables.css)
│   └── forms/                     # FormField, FormSelect, FormDatePicker — React Hook Form wrappers
│
├── layouts/
│   ├── AuthLayout.jsx              # Login / Forgot / Reset Password / Session Expired
│   ├── MainLayout.jsx              # Sidebar + Navbar + content outlet (authenticated app)
│   └── ErrorLayout.jsx             # 401 / 403 / 404 / 500 pages
│
├── pages/
│   ├── auth/                       # Login, ForgotPassword, ResetPassword, SessionExpired
│   ├── dashboard/                  # Dashboard
│   ├── company/                    # CompanySettings
│   ├── users/                      # UserList, UserForm, UserDetail
│   ├── roles/                      # RoleList, RoleForm, PermissionMatrix
│   ├── branches/                   # BranchList, BranchForm, BranchDetail
│   ├── profile/                    # Profile, ChangePassword, LoginDevices
│   ├── categories/                 # CategoryList, CategoryForm
│   ├── brands/                     # BrandList, BrandForm
│   ├── products/                   # ProductList, ProductForm, ProductDetail, LabelPrint
│   ├── inventory/                  # InventoryOverview, StockMovements, StockAdjustments
│   ├── suppliers/                  # SupplierList, SupplierForm, SupplierDetail
│   ├── purchases/                  # PurchaseList, PurchaseForm, PurchaseDetail
│   ├── transfers/                  # TransferList, TransferForm, TransferDetail
│   ├── customers/                  # CustomerList, CustomerForm, CustomerDetail
│   ├── pos/                        # POS (main screen)
│   ├── sales/                      # SaleHistory, SaleDetail, ReceiptPreview
│   ├── returns/                    # ReturnList, ReturnForm
│   ├── expenses/                   # ExpenseList, ExpenseForm
│   ├── carwash/                    # VehicleRegister, CarWashHistory
│   ├── reports/                    # ReportsCenter + one page per report category
│   ├── notifications/              # NotificationsPage
│   ├── settings/                   # SystemSettings
│   └── errors/                     # NotFound404, Forbidden403, Unauthorized401, ServerError500
│
├── hooks/
│   ├── useAuth.js
│   ├── usePermission.js
│   ├── usePagination.js
│   ├── useDebounce.js
│   ├── useTable.js                 # sorting/filtering/pagination state for data tables
│   ├── useQRScanner.js             # wraps html5-qrcode lifecycle
│   ├── useBranch.js
│   └── useNotifications.js         # polling
│
├── services/                       # one Axios module per API resource, mirrors API_PLAN.md
│   ├── apiClient.js                 # Axios instance, interceptors (auth header, refresh-on-401)
│   ├── authService.js
│   ├── userService.js
│   ├── roleService.js
│   ├── branchService.js
│   ├── companyService.js
│   ├── settingsService.js
│   ├── categoryService.js
│   ├── brandService.js
│   ├── productService.js
│   ├── inventoryService.js
│   ├── supplierService.js
│   ├── purchaseService.js
│   ├── transferService.js
│   ├── customerService.js
│   ├── saleService.js
│   ├── returnService.js
│   ├── expenseService.js
│   ├── carwashService.js
│   ├── reportService.js
│   ├── notificationService.js
│   └── dashboardService.js
│
├── contexts/
│   ├── AuthContext.jsx
│   ├── BranchContext.jsx
│   ├── NotificationContext.jsx
│   └── PermissionContext.jsx
│
├── utils/
│   ├── formatCurrency.js
│   ├── formatDate.js
│   ├── validators.js
│   ├── permissionCheck.js
│   ├── printHelpers.js
│   ├── exportHelpers.js
│   └── tokenStorage.js             # in-memory access-token handling (never localStorage)
│
├── constants/
│   ├── roles.js
│   ├── permissions.js
│   ├── routes.js
│   ├── paymentMethods.js
│   └── movementTypes.js
│
├── router/
│   ├── AppRouter.jsx
│   ├── ProtectedRoute.jsx          # requires auth
│   ├── PermissionRoute.jsx         # requires auth + specific permission
│   └── routesConfig.js
│
├── styles/
│   ├── variables.css               # design tokens: color, spacing, radius, shadow, font vars
│   ├── colors.css                  # gold/black brand palette (see PROJECT_PLAN.md §2)
│   ├── typography.css              # Poppins import + weight/size scale
│   ├── spacing.css                 # spacing scale utilities/tokens
│   ├── buttons.css
│   ├── forms.css
│   ├── tables.css
│   ├── cards.css
│   ├── layout.css                  # grid/flex shells for Sidebar/Navbar/content area
│   ├── animations.css              # Framer-Motion-complementary keyframes/transitions
│   ├── responsive.css              # breakpoint mixV-equivalent rules (desktop→laptop→tablet→mobile)
│   ├── utilities.css               # spacing/text/display helper classes
│   ├── theme.css                   # aggregates variables/colors into the single applied theme
│   ├── components/                 # one CSS file per shared component (Button.css, Modal.css, Table.css, ...)
│   └── pages/                      # one CSS file per page where page-specific layout is needed (POS.css, Dashboard.css, ...)
│
├── icons/                          # logo SVGs + any custom icon not covered by react-icons
│
├── App.jsx
├── main.jsx
└── index.css                        # imports styles/theme.css only — no ad-hoc global CSS
```

CSS import order (enforced in `index.css`/`theme.css`): `variables.css` → `colors.css` → `typography.css` → `spacing.css` → `layout.css` → component/page files → `animations.css` → `responsive.css` → `utilities.css`. This keeps cascade/specificity predictable across ~13 top-level files plus per-component/page files.

---

## 3. Backend — `backend/`

```
backend/
├── config/
│   ├── db.js                       # MySQL pool (mysql2)
│   ├── env.js                      # validated env accessor
│   ├── cors.js
│   ├── multer.js                   # upload constraints (type/size)
│   └── logger.js                   # winston setup
│
├── controllers/                    # one file per resource, thin — calls services only
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── role.controller.js
│   ├── branch.controller.js
│   ├── company.controller.js
│   ├── settings.controller.js
│   ├── category.controller.js
│   ├── brand.controller.js
│   ├── product.controller.js
│   ├── inventory.controller.js
│   ├── supplier.controller.js
│   ├── purchase.controller.js
│   ├── transfer.controller.js
│   ├── customer.controller.js
│   ├── sale.controller.js
│   ├── return.controller.js
│   ├── expense.controller.js
│   ├── carwash.controller.js
│   ├── report.controller.js
│   ├── notification.controller.js
│   └── dashboard.controller.js
│
├── services/                       # ALL business logic lives here
│   ├── auth.service.js
│   ├── user.service.js
│   ├── role.service.js
│   ├── branch.service.js
│   ├── company.service.js
│   ├── settings.service.js
│   ├── category.service.js
│   ├── brand.service.js
│   ├── product.service.js
│   ├── inventory.service.js        # single source of truth for stock mutation
│   ├── supplier.service.js
│   ├── purchase.service.js
│   ├── transfer.service.js
│   ├── customer.service.js
│   ├── sale.service.js
│   ├── return.service.js
│   ├── expense.service.js
│   ├── carwash.service.js
│   ├── report.service.js
│   ├── notification.service.js
│   ├── dashboard.service.js
│   ├── codeGenerator.service.js    # document_sequences engine (products/sales/purchases/transfers/returns)
│   ├── qrCode.service.js
│   ├── pdf.service.js
│   ├── export.service.js           # excel/csv
│   ├── email.service.js
│   └── audit.service.js            # writes audit_logs + activity_logs
│
├── repositories/                   # ALL SQL lives here, one per table/aggregate
│   ├── user.repository.js
│   ├── role.repository.js
│   ├── permission.repository.js
│   ├── branch.repository.js
│   ├── company.repository.js
│   ├── settings.repository.js
│   ├── category.repository.js
│   ├── brand.repository.js
│   ├── product.repository.js
│   ├── inventory.repository.js
│   ├── supplier.repository.js
│   ├── purchase.repository.js
│   ├── transfer.repository.js
│   ├── customer.repository.js
│   ├── sale.repository.js
│   ├── return.repository.js
│   ├── expense.repository.js
│   ├── carwash.repository.js
│   ├── notification.repository.js
│   ├── auditLog.repository.js
│   ├── activityLog.repository.js
│   └── sequence.repository.js
│
├── routes/
│   ├── index.js                    # mounts all module routers under /api/v1
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── role.routes.js
│   ├── branch.routes.js
│   ├── company.routes.js
│   ├── settings.routes.js
│   ├── category.routes.js
│   ├── brand.routes.js
│   ├── product.routes.js
│   ├── inventory.routes.js
│   ├── supplier.routes.js
│   ├── purchase.routes.js
│   ├── transfer.routes.js
│   ├── customer.routes.js
│   ├── sale.routes.js
│   ├── return.routes.js
│   ├── expense.routes.js
│   ├── carwash.routes.js
│   ├── report.routes.js
│   ├── notification.routes.js
│   └── dashboard.routes.js
│
├── middlewares/
│   ├── authenticate.js             # JWT verify
│   ├── authorize.js                # permission-code check
│   ├── branchScope.js              # filters queries to accessible branches
│   ├── validateRequest.js          # express-validator result handler
│   ├── rateLimiter.js
│   ├── upload.js                   # multer instances per use-case
│   └── errorHandler.js             # centralized, never leaks stack/SQL
│
├── validators/                     # express-validator chains, one file per resource
│   └── (auth|user|role|branch|company|settings|category|brand|product|inventory|
│         supplier|purchase|transfer|customer|sale|return|expense|carwash).validator.js
│
├── utils/
│   ├── apiResponse.js              # success()/error() envelope helpers
│   ├── asyncHandler.js
│   ├── tokenUtils.js
│   └── constants.js
│
├── database/
│   ├── migrations/                 # numbered, one per table/change
│   └── seeders/                    # roles, permissions, default Super Admin, expense_categories, carwash_services
│
├── jobs/                           # node-cron
│   ├── lowStockCheck.job.js
│   ├── tokenCleanup.job.js
│   └── dailyBackup.job.js
│
├── uploads/                        # runtime file storage (logo, avatars, product images, receipts) — gitignored
├── app.js                          # Express app: Helmet, CORS, rate limit, routes, error handler
├── server.js                       # entrypoint, DB connection bootstrap, listen
├── .env.example
├── .eslintrc / eslint.config.js
└── package.json
```

---

## 4. Naming & Organization Rules

- One component/page = one file = one responsibility. No file mixes list + form + detail logic.
- Every `pages/<module>/` folder co-locates its own `styles/pages/<Module>.css` counterpart if page-specific layout is needed beyond the shared design system files.
- Backend: a controller **never** imports `mysql2` directly; a service **never** builds raw SQL; only repositories touch the database.
- No file in `src/` imports a CSS framework — only files under `src/styles/` and their `import` statements in components.
