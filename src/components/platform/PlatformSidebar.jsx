import { NavLink } from 'react-router-dom';
import { FiGrid, FiBriefcase, FiFileText, FiBell, FiSettings, FiLogOut } from 'react-icons/fi';
import { usePlatformAuth } from '../../hooks/usePlatformAuth';
import { PLATFORM_ROUTES } from '../../constants/routes';

const NAV_ITEMS = [
  { to: PLATFORM_ROUTES.DASHBOARD, label: 'Dashboard', icon: FiGrid },
  { to: PLATFORM_ROUTES.TENANTS, label: 'Tenants', icon: FiBriefcase },
  { to: PLATFORM_ROUTES.AUDIT_LOG, label: 'Audit Log', icon: FiFileText },
  { to: PLATFORM_ROUTES.NOTIFICATIONS, label: 'Notifications', icon: FiBell },
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
