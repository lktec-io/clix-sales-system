import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FiGrid, FiUserCheck, FiTruck,
  FiBox, FiArchive, FiShoppingCart, FiDollarSign, FiRotateCcw,
  FiBarChart2, FiCreditCard, FiSettings, FiLogOut,
  FiChevronsLeft, FiChevronsRight, FiMapPin, FiUsers, FiShield, FiBell, FiRepeat, FiClock, FiCheckCircle, FiLayers,
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useCompany } from '../../hooks/useCompany';
import { useModules } from '../../hooks/useModules';
import { ROUTES } from '../../constants/routes';
import '../../styles/components/Sidebar.css';

// Resolves a module registry's `icon` string (e.g. "FiBox") to the actual
// react-icons component — the backend can send config, never JSX. Falls
// back to a generic icon for any future icon key this list doesn't know
// about yet, rather than crashing.
const ICON_MAP = {
  FiGrid, FiUserCheck, FiTruck, FiBox, FiArchive, FiShoppingCart, FiDollarSign, FiRotateCcw,
  FiBarChart2, FiCreditCard, FiSettings, FiMapPin, FiUsers, FiShield, FiBell, FiRepeat, FiClock, FiCheckCircle, FiLayers,
};
function resolveIcon(iconKey) {
  return ICON_MAP[iconKey] || FiGrid;
}

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

// Phase 5 — data-driven, not hardcoded: NAV_ITEMS is built from
// GET /modules/me (ModuleContext/useModules), which has already resolved
// this tenant's Business Template + any per-tenant override + the global
// module registry. A module only renders as a top-level link when it
// carries a `route` — branches/users/permissions/notifications resolve
// with route=NULL in the registry (026_create_module_framework_tables.sql)
// specifically so they stay reachable only via Settings/the Navbar, exactly
// as before Phase 5, never becoming new top-level links.
//
// `requiredPermission` is still checked below exactly as before — modules
// only narrow the MAXIMUM visible set; a user's actual permissions narrow
// it further. Every module's required_permission column points at a
// permission code that already existed pre-Phase-5.
//
// Billing is Phase 4's own always-on feature, deliberately outside the
// module framework (explicitly "DO NOT CHANGE... Billing Engine") — kept
// as a fixed, permission-gated entry inserted at its original position,
// immediately before Settings.
function useNavItems(modules) {
  const { t } = useTranslation('sidebar');

  const moduleItems = modules
    .filter((module) => module.route)
    .slice()
    .sort((a, b) => a.navigationOrder - b.navigationOrder)
    .map((module) => ({
      to: module.route,
      label: t(`nav.${module.key}`, { defaultValue: module.name }),
      icon: resolveIcon(module.icon),
      end: module.key === 'dashboard',
      requiredPermission: module.requiredPermission ? module.requiredPermission.split(',') : undefined,
    }));

  const billingItem = { to: ROUTES.BILLING, label: t('nav.billing'), icon: FiCreditCard, requiredPermission: ['company.manage'] };
  const settingsIndex = moduleItems.findIndex((item) => item.to === '/settings/company');
  if (settingsIndex === -1) return [...moduleItems, billingItem];
  return [...moduleItems.slice(0, settingsIndex), billingItem, ...moduleItems.slice(settingsIndex)];
}

function Sidebar({ collapsed, onToggle, onNavigate, isOpen }) {
  const { t } = useTranslation('sidebar');
  const { logout, hasPermission } = useAuth();
  const { company } = useCompany();
  const { modules } = useModules();
  const navigate = useNavigate();
  const NAV_ITEMS = useNavItems(modules);
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
          {!collapsed && <span className="sidebar-link-label">{t('logout')}</span>}
        </button>
        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={onToggle}
          aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
        >
          {collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
