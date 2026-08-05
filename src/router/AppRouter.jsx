import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../layouts/AuthLayout';
import MainLayout from '../layouts/MainLayout';
import ErrorLayout from '../layouts/ErrorLayout';
import PlatformAuthLayout from '../layouts/PlatformAuthLayout';
import PlatformLayout from '../layouts/PlatformLayout';
import ProtectedRoute from './ProtectedRoute';
import PlatformProtectedRoute from './PlatformProtectedRoute';
import RequirePermission from './RequirePermission';
import HomeGate from './HomeGate';
import { ROUTES, PLATFORM_ROUTES } from '../constants/routes';

// Route-level code splitting — every page below is its own chunk, fetched
// on navigation instead of bloating the initial bundle. This is the pattern
// every future phase's pages should follow.
const Register = lazy(() => import('../pages/auth/Register'));
const Login = lazy(() => import('../pages/auth/Login'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const SessionExpired = lazy(() => import('../pages/auth/SessionExpired'));
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));
const CompanySettings = lazy(() => import('../pages/company/CompanySettings'));
const UserList = lazy(() => import('../pages/users/UserList'));
const UserForm = lazy(() => import('../pages/users/UserForm'));
const RoleList = lazy(() => import('../pages/roles/RoleList'));
const BranchList = lazy(() => import('../pages/branches/BranchList'));
const BranchForm = lazy(() => import('../pages/branches/BranchForm'));
const ProductList = lazy(() => import('../pages/products/ProductList'));
const ProductForm = lazy(() => import('../pages/products/ProductForm'));
const ArchivedProducts = lazy(() => import('../pages/products/ArchivedProducts'));
const InventoryOverview = lazy(() => import('../pages/inventory/InventoryOverview'));
const StockMovements = lazy(() => import('../pages/inventory/StockMovements'));
const SupplierList = lazy(() => import('../pages/suppliers/SupplierList'));
const SupplierDetail = lazy(() => import('../pages/suppliers/SupplierDetail'));
const PurchaseList = lazy(() => import('../pages/purchases/PurchaseList'));
const PurchaseForm = lazy(() => import('../pages/purchases/PurchaseForm'));
const PurchaseDetail = lazy(() => import('../pages/purchases/PurchaseDetail'));
const CustomerList = lazy(() => import('../pages/customers/CustomerList'));
const CustomerDetail = lazy(() => import('../pages/customers/CustomerDetail'));
const POS = lazy(() => import('../pages/pos/POS'));
const SaleList = lazy(() => import('../pages/pos/SaleList'));
const SaleDetail = lazy(() => import('../pages/pos/SaleDetail'));
const ReturnList = lazy(() => import('../pages/returns/ReturnList'));
const ReturnForm = lazy(() => import('../pages/returns/ReturnForm'));
const ReturnDetail = lazy(() => import('../pages/returns/ReturnDetail'));
const ExpenseList = lazy(() => import('../pages/expenses/ExpenseList'));
const ReportsCenter = lazy(() => import('../pages/reports/ReportsCenter'));
const BillingOverview = lazy(() => import('../pages/billing/BillingOverview'));
const InvoiceDetail = lazy(() => import('../pages/billing/InvoiceDetail'));
const SystemSettings = lazy(() => import('../pages/settings/SystemSettings'));
const ExpenseCategorySettings = lazy(() => import('../pages/settings/ExpenseCategorySettings'));
const Profile = lazy(() => import('../pages/profile/Profile'));
const NotFound404 = lazy(() => import('../pages/errors/NotFound404'));
const Forbidden403 = lazy(() => import('../pages/errors/Forbidden403'));

// Phase 3 — Clix SaaS Owner Portal. Fully separate lazy chunks from every
// tenant page above; PlatformProtectedRoute/PlatformAuthLayout never
// import anything tenant-specific (useAuth, useCompany, ROUTES).
const PlatformLogin = lazy(() => import('../pages/platform/auth/PlatformLogin'));
const PlatformDashboard = lazy(() => import('../pages/platform/dashboard/PlatformDashboard'));
const TenantList = lazy(() => import('../pages/platform/tenants/TenantList'));
const TenantDetail = lazy(() => import('../pages/platform/tenants/TenantDetail'));
const AuditLog = lazy(() => import('../pages/platform/audit/AuditLog'));
const PlatformNotifications = lazy(() => import('../pages/platform/notifications/PlatformNotifications'));
const PlatformSettings = lazy(() => import('../pages/platform/settings/PlatformSettings'));
const PlanList = lazy(() => import('../pages/platform/plans/PlanList'));
const BillingDashboard = lazy(() => import('../pages/platform/billing/BillingDashboard'));

function RouteFallback() {
  const { t } = useTranslation('common');
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <span className="spinner" aria-label={t('state.loading')} />
    </div>
  );
}

// Bookmark-safety redirect for an id-scoped route that moved under
// Settings — preserves the :id param instead of dropping the user at a
// generic list page.
function RedirectWithId({ to }) {
  const { id } = useParams();
  return <Navigate to={to.replace(':id', id)} replace />;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path={ROUTES.HOME} element={<HomeGate />} />

          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<Login />} />
            <Route path={ROUTES.REGISTER} element={<Register />} />
            <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
            <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
            <Route path={ROUTES.SESSION_EXPIRED} element={<SessionExpired />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
              <Route path={ROUTES.SETTINGS_COMPANY} element={<RequirePermission permission="company.manage"><CompanySettings /></RequirePermission>} />
              <Route path="/settings/branches" element={<RequirePermission permission="branches.view"><BranchList /></RequirePermission>} />
              <Route path="/settings/branches/new" element={<RequirePermission permission="branches.view"><BranchForm /></RequirePermission>} />
              <Route path="/settings/branches/:id/edit" element={<RequirePermission permission="branches.view"><BranchForm /></RequirePermission>} />
              <Route path="/settings/users" element={<RequirePermission permission="users.view"><UserList /></RequirePermission>} />
              <Route path="/settings/users/new" element={<RequirePermission permission="users.view"><UserForm /></RequirePermission>} />
              <Route path="/settings/users/:id/edit" element={<RequirePermission permission="users.view"><UserForm /></RequirePermission>} />
              <Route path="/settings/permissions" element={<RequirePermission permission="roles.view"><RoleList /></RequirePermission>} />
              <Route path="/settings/expense-categories" element={<RequirePermission permission="settings.manage"><ExpenseCategorySettings /></RequirePermission>} />
              <Route path="/settings/system" element={<RequirePermission permission="settings.view"><SystemSettings /></RequirePermission>} />
              <Route path="/profile" element={<Profile />} />

              {/* Bookmark-safety redirects — these pages moved under Settings. */}
              <Route path="/users" element={<Navigate to="/settings/users" replace />} />
              <Route path="/users/new" element={<Navigate to="/settings/users/new" replace />} />
              <Route path="/users/:id/edit" element={<RedirectWithId to="/settings/users/:id/edit" />} />
              <Route path="/roles" element={<Navigate to="/settings/permissions" replace />} />
              <Route path="/roles/:id/permissions" element={<Navigate to="/settings/permissions" replace />} />
              <Route path="/branches" element={<Navigate to="/settings/branches" replace />} />
              <Route path="/branches/new" element={<Navigate to="/settings/branches/new" replace />} />
              <Route path="/branches/:id/edit" element={<RedirectWithId to="/settings/branches/:id/edit" />} />

              <Route path="/products" element={<RequirePermission permission="products.view"><ProductList /></RequirePermission>} />
              <Route path="/products/archived" element={<RequirePermission permission="products.delete"><ArchivedProducts /></RequirePermission>} />
              <Route path="/products/new" element={<RequirePermission permission="products.view"><ProductForm /></RequirePermission>} />
              <Route path="/products/:id/edit" element={<RequirePermission permission="products.view"><ProductForm /></RequirePermission>} />
              <Route path="/inventory" element={<RequirePermission permission="inventory.view"><InventoryOverview /></RequirePermission>} />
              <Route path="/inventory/movements" element={<RequirePermission permission="inventory.view"><StockMovements /></RequirePermission>} />
              <Route path="/suppliers" element={<RequirePermission permission="suppliers.view"><SupplierList /></RequirePermission>} />
              <Route path="/suppliers/:id" element={<RequirePermission permission="suppliers.view"><SupplierDetail /></RequirePermission>} />
              <Route path="/purchases" element={<RequirePermission permission="purchases.view"><PurchaseList /></RequirePermission>} />
              <Route path="/purchases/new" element={<RequirePermission permission="purchases.view"><PurchaseForm /></RequirePermission>} />
              <Route path="/purchases/:id" element={<RequirePermission permission="purchases.view"><PurchaseDetail /></RequirePermission>} />
              <Route path="/customers" element={<RequirePermission permission="customers.view"><CustomerList /></RequirePermission>} />
              <Route path="/customers/:id" element={<RequirePermission permission="customers.view"><CustomerDetail /></RequirePermission>} />
              <Route path="/pos" element={<RequirePermission permission="sales.view"><POS /></RequirePermission>} />
              <Route path="/pos/sales" element={<RequirePermission permission="sales.view"><SaleList /></RequirePermission>} />
              <Route path="/pos/sales/:id" element={<RequirePermission permission="sales.view"><SaleDetail /></RequirePermission>} />
              <Route path="/returns" element={<RequirePermission permission="returns.view"><ReturnList /></RequirePermission>} />
              <Route path="/returns/new" element={<RequirePermission permission="returns.view"><ReturnForm /></RequirePermission>} />
              <Route path="/returns/:id" element={<RequirePermission permission="returns.view"><ReturnDetail /></RequirePermission>} />
              <Route path="/expenses" element={<RequirePermission permission="expenses.view"><ExpenseList /></RequirePermission>} />
              <Route path="/reports" element={<RequirePermission permission="reports.view"><ReportsCenter /></RequirePermission>} />
              <Route path={ROUTES.BILLING} element={<RequirePermission permission="company.manage"><BillingOverview /></RequirePermission>} />
              <Route path={ROUTES.BILLING_INVOICE} element={<RequirePermission permission="company.manage"><InvoiceDetail /></RequirePermission>} />
            </Route>
          </Route>

          <Route element={<PlatformAuthLayout />}>
            <Route path={PLATFORM_ROUTES.LOGIN} element={<PlatformLogin />} />
          </Route>

          <Route element={<PlatformProtectedRoute />}>
            <Route element={<PlatformLayout />}>
              <Route path={PLATFORM_ROUTES.DASHBOARD} element={<PlatformDashboard />} />
              <Route path={PLATFORM_ROUTES.TENANTS} element={<TenantList />} />
              <Route path={`${PLATFORM_ROUTES.TENANTS}/:id`} element={<TenantDetail />} />
              <Route path={PLATFORM_ROUTES.AUDIT_LOG} element={<AuditLog />} />
              <Route path={PLATFORM_ROUTES.NOTIFICATIONS} element={<PlatformNotifications />} />
              <Route path={PLATFORM_ROUTES.SETTINGS} element={<PlatformSettings />} />
              <Route path={PLATFORM_ROUTES.PLANS} element={<PlanList />} />
              <Route path={PLATFORM_ROUTES.BILLING} element={<BillingDashboard />} />
            </Route>
          </Route>

          <Route element={<ErrorLayout />}>
            <Route path={ROUTES.FORBIDDEN} element={<Forbidden403 />} />
            <Route path={ROUTES.NOT_FOUND} element={<NotFound404 />} />
            <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRouter;
