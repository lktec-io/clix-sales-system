import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiGrid, FiUserCheck, FiTruck,
  FiBox, FiArchive, FiShoppingCart, FiDollarSign, FiRotateCcw,
  FiBarChart2, FiSettings, FiLogOut,
  FiChevronsLeft, FiChevronsRight,
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useCompany } from '../../hooks/useCompany';
import { ROUTES } from '../../constants/routes';
import '../../styles/components/Sidebar.css';

// Staggered reveal, played only when the mobile drawer opens (see the
// openKey/key-remount trick in Sidebar() below) — on desktop isOpen
// never becomes true so this never triggers, avoiding an unwanted
// animate-in on every load. Each label fades in and translates from
// 24px right to its resting position over 500ms (mid-range of the
// 400-600ms premium feel requested) — with 12 items, a 35ms stagger and
// 50ms initial delay puts the LAST item's animation finishing at ~935ms,
// which reads as an elegant cascade rather than a slow trickle.
const NAV_STAGGER_CONTAINER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};

const NAV_ICON_VARIANT = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
};

const NAV_LABEL_VARIANT = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// Branches, Users, Roles, Categories, Brands, Notifications, and Profile
// are intentionally not top-level nav items — they're reachable via
// Settings, the Product form, or the Navbar (Profile, notification bell)
// instead. Transfers has no UI at all anymore (backend untouched). Returns
// is a full top-level module, matching the client's module list.
//
// `requiredPermission` (a single code, or an array checked with .some() for
// items reachable via more than one gate) matches the same permission
// vocabulary the backend's authorize() middleware and the route-level
// RequirePermission guards use — a role only sees the modules its seeded
// permissions actually unlock. Dashboard has no gate: every role is seeded
// with dashboard.view.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/customers', label: 'Customers', icon: FiUserCheck, requiredPermission: 'customers.view' },
  { to: '/suppliers', label: 'Suppliers', icon: FiTruck, requiredPermission: 'suppliers.view' },
  { to: '/products', label: 'Products', icon: FiBox, requiredPermission: 'products.view' },
  { to: '/inventory', label: 'Inventory', icon: FiArchive, requiredPermission: 'inventory.view' },
  { to: '/purchases', label: 'Purchases', icon: FiShoppingCart, requiredPermission: 'purchases.view' },
  { to: '/pos', label: 'Sales (POS)', icon: FiDollarSign, requiredPermission: 'sales.view' },
  { to: '/returns', label: 'Returns', icon: FiRotateCcw, requiredPermission: 'returns.view' },
  { to: '/expenses', label: 'Expenses', icon: FiDollarSign, requiredPermission: 'expenses.view' },
  { to: '/reports', label: 'Reports', icon: FiBarChart2, requiredPermission: 'reports.view' },
  { to: '/settings/company', label: 'Settings', icon: FiSettings, requiredPermission: ['company.manage', 'settings.view'] },
];

function Sidebar({ collapsed, onToggle, onNavigate, isOpen }) {
  const { logout, hasPermission } = useAuth();
  const { company } = useCompany();
  const navigate = useNavigate();
  const companyName = company?.company_name || 'Clix';

  // Plain function call, not the usePermission() hook — this runs once per
  // item inside a .filter() below, and hooks can't be called in a loop.
  const isNavItemVisible = (item) => {
    if (!item.requiredPermission) return true;
    if (Array.isArray(item.requiredPermission)) return item.requiredPermission.some(hasPermission);
    return hasPermission(item.requiredPermission);
  };
  const visibleNavItems = NAV_ITEMS.filter(isNavItemVisible);

  // Replays the label/icon stagger every time the mobile drawer opens: each
  // open increments openKey, which remounts the nav list so its "hidden"
  // initial state applies fresh. Desktop never toggles isOpen (the
  // hamburger button that would is hidden there), so openKey stays 0
  // forever and initial={false} below keeps desktop's instant, unanimated
  // rendering exactly as it was. Derived directly during render (not an
  // effect) per React's "adjusting state when a prop changes" pattern —
  // this is a prop-driven derivation, not a side effect. `isOpen` is the
  // SAME state MainLayout uses for the overlay, the drawer panel, and
  // Navbar's icon — this component never tracks its own copy of it.
  const [openKey, setOpenKey] = useState(0);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setOpenKey((key) => key + 1);
  }

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  // Explicit close-before-navigate: intercept the NavLink's own navigation,
  // close the drawer synchronously, then navigate on the next animation
  // frame so the close is guaranteed to be the first visible effect of the
  // tap rather than something that merely happens to be scheduled
  // alongside routing. NavLink is kept (not swapped for a plain button)
  // purely for its automatic isActive styling — the current route still
  // drives that regardless of how navigation was triggered.
  const handleNavClick = (event, to) => {
    event.preventDefault();
    onNavigate?.();
    requestAnimationFrame(() => {
      navigate(to);
    });
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        {company?.logo_path ? (
          <>
            <img src={company.logo_path} alt={companyName} className="sidebar-brand-logo" />
            {!collapsed && <span className="sidebar-brand-name">{companyName}</span>}
          </>
        ) : (
          <span className="sidebar-brand-mark">{collapsed ? companyName.charAt(0) : companyName}</span>
        )}
      </div>

      <motion.nav
        key={openKey}
        className="sidebar-nav"
        variants={NAV_STAGGER_CONTAINER}
        initial={openKey === 0 ? false : 'hidden'}
        animate="visible"
      >
        {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            onClick={(event) => handleNavClick(event, to)}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    className="sidebar-link-indicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <motion.span className="sidebar-link-icon" variants={NAV_ICON_VARIANT}>
                  <Icon aria-hidden="true" />
                </motion.span>
                {!collapsed && (
                  <motion.span className="sidebar-link-label" variants={NAV_LABEL_VARIANT}>
                    {label}
                  </motion.span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </motion.nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-link sidebar-logout" onClick={handleLogout}>
          <FiLogOut className="sidebar-link-icon" aria-hidden="true" />
          {!collapsed && <span className="sidebar-link-label">Logout</span>}
        </button>
        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
