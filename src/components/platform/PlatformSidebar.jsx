import { NavLink } from 'react-router-dom';
import { FiGrid, FiBriefcase, FiFileText, FiBell, FiCreditCard, FiTrendingUp, FiSettings, FiLogOut, FiLayers, FiDollarSign } from 'react-icons/fi';
import { usePlatformAuth } from '../../hooks/usePlatformAuth';
import { PLATFORM_ROUTES } from '../../constants/routes';

// The raw module-registry CRUD page (/platform/modules) is deliberately
// not linked here — it's a one-time-setup technical tool (defining what
// "Sales"/"Inventory"/etc. even are), not part of daily platform
// management, and Business Templates already exposes the per-template
// module map admins actually touch day to day. The route/page/backend
// are untouched and still directly reachable — this narrows navigation,
// it doesn't remove capability.
const NAV_ITEMS = [
  { to: PLATFORM_ROUTES.DASHBOARD, label: 'Dashboard', icon: FiGrid },
  { to: PLATFORM_ROUTES.TENANTS, label: 'Tenants', icon: FiBriefcase },
  { to: PLATFORM_ROUTES.TEMPLATES, label: 'Business Templates', icon: FiLayers },
  { to: PLATFORM_ROUTES.PLANS, label: 'Plans', icon: FiCreditCard },
  { to: PLATFORM_ROUTES.BILLING, label: 'Billing', icon: FiTrendingUp },
  { to: PLATFORM_ROUTES.PAYMENTS, label: 'Payments', icon: FiDollarSign },
  { to: PLATFORM_ROUTES.NOTIFICATIONS, label: 'Notifications', icon: FiBell },
  { to: PLATFORM_ROUTES.AUDIT_LOG, label: 'Audit Log', icon: FiFileText },
  { to: PLATFORM_ROUTES.SETTINGS, label: 'Settings', icon: FiSettings },
];

function PlatformSidebar() {
  const { logout } = usePlatformAuth();

  return (
    <div className="platform-sidebar-inner">
      <div className="platform-sidebar-brand">
        <span className="platform-sidebar-brand-mark">Clix</span>
        <span className="platform-sidebar-brand-sub">Owner Portal</span>
      </div>

      <nav className="platform-sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `platform-sidebar-link ${isActive ? 'is-active' : ''}`}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button type="button" className="platform-sidebar-logout" onClick={logout}>
        <FiLogOut aria-hidden="true" />
        <span>Logout</span>
      </button>
    </div>
  );
}

export default PlatformSidebar;
