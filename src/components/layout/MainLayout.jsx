import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiLogOut, FiChevronsLeft, FiChevronDown, FiX, FiMenu, FiSettings, FiMapPin, FiCreditCard,
  FiArrowUpRight, FiArrowDownRight, FiMinus,
} from 'react-icons/fi';
import Navbar from './Navbar';
import PageTransition from '../common/PageTransition';
import { useAuth } from '../../hooks/useAuth';
import { useCompany } from '../../hooks/useCompany';
import { useModules } from '../../hooks/useModules';
import { useNavigationItems } from '../../hooks/useNavigationItems';
import * as dashboardService from '../../services/dashboardService';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import { ROUTES } from '../../constants/routes';
import styles from './MainLayout.module.css';

const cx = (...classNames) => classNames.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Viewport — kept in sync with the breakpoints in MainLayout.module.css.
// ---------------------------------------------------------------------------

const VIEWPORT_QUERIES = {
  mobile: '(max-width: 768px)',
  desktop: '(min-width: 1280px)',
};

function subscribeViewport(onChange) {
  const lists = Object.values(VIEWPORT_QUERIES).map((query) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener('change', onChange));
  return () => lists.forEach((list) => list.removeEventListener('change', onChange));
}

function getViewport() {
  if (window.matchMedia(VIEWPORT_QUERIES.mobile).matches) return 'mobile';
  if (window.matchMedia(VIEWPORT_QUERIES.desktop).matches) return 'desktop';
  return 'tablet';
}

function useViewport() {
  return useSyncExternalStore(subscribeViewport, getViewport, () => 'desktop');
}

// Desktop collapse preference is a per-device convenience — storage can be
// unavailable (private mode, blocked site data), so every access is guarded.
const COLLAPSE_STORAGE_KEY = 'clix-sidebar-collapsed';

function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredCollapsed(collapsed) {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // Preference simply won't persist — layout still works.
  }
}

const SIDEBAR_ID = 'app-sidebar';
const NAV_SKELETON_ROWS = 7;

// Routes where every pixel belongs to the transaction workflow — no stats
// bar, no mobile tab bar (the POS cart sheet owns the bottom edge there).
const FOCUS_ROUTES = new Set(['/pos', '/pharmacy/sales/new', '/restaurant/orders/new', '/kitchen']);

// ---------------------------------------------------------------------------
// Workspace menu — the tenant this account belongs to (logo, name, business
// template) with its workspace-level shortcuts. Each Clix account belongs to
// exactly one tenant, so this is the workspace switchboard, not a switch to
// another tenant.
// ---------------------------------------------------------------------------

function WorkspaceMenu({ collapsed, onNavigate }) {
  const { t } = useTranslation(['sidebar', 'landing']);
  const { company } = useCompany();
  const { businessTemplateSlug } = useModules();
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const menuId = useId();

  const companyName = company?.company_name || 'Clix Sales System';
  const templateLabel = businessTemplateSlug
    ? t(`landing:businessTypes.${businessTemplateSlug}.name`, { defaultValue: '' })
    : '';

  const items = [
    { to: '/settings/company', label: t('sidebar:workspace.companySettings'), icon: FiSettings, permission: 'company.manage' },
    { to: '/settings/branches', label: t('sidebar:workspace.branches'), icon: FiMapPin, permission: 'branches.view' },
    { to: ROUTES.BILLING, label: t('sidebar:workspace.billing'), icon: FiCreditCard, permission: 'company.manage' },
  ].filter((item) => hasPermission(item.permission));

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const hasMenu = items.length > 0;

  return (
    <div ref={containerRef} className={styles.workspace} data-open={open}>
      <button
        type="button"
        className={styles.workspaceButton}
        onClick={() => hasMenu && setOpen((prev) => !prev)}
        aria-expanded={hasMenu ? open : undefined}
        aria-controls={hasMenu ? menuId : undefined}
        aria-label={t('sidebar:workspace.label', { name: companyName })}
        title={collapsed ? companyName : undefined}
        disabled={!hasMenu}
      >
        {company?.logo_path ? (
          <img src={company.logo_path} alt="" className={styles.brandLogo} />
        ) : (
          <span className={styles.brandMark} aria-hidden="true">{companyName.charAt(0).toUpperCase()}</span>
        )}
        <span className={cx(styles.workspaceText, styles.fadeLabel)}>
          <span className={styles.workspaceName}>{companyName}</span>
          {templateLabel && <span className={styles.workspaceMeta}>{templateLabel}</span>}
        </span>
        {hasMenu && <FiChevronDown className={cx(styles.workspaceCaret, styles.fadeLabel)} aria-hidden="true" />}
      </button>

      {hasMenu && (
        <div id={menuId} className={styles.workspaceMenu} inert={!open}>
          <div className={styles.workspaceMenuInner}>
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) => cx(styles.navLink, styles.workspaceItem, isActive && styles.navLinkActive)}
                onClick={() => {
                  setOpen(false);
                  onNavigate();
                }}
              >
                <Icon className={styles.navIcon} aria-hidden="true" />
                <span className={styles.fadeLabel}>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({ viewport, collapsed, open, overlay, navigation, onNavigate, onToggle, onClose }) {
  const { t } = useTranslation('sidebar');
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { loading, mainItems, bottomItems } = navigation;
  const isMobile = viewport === 'mobile';

  const handleLogout = async () => {
    onNavigate();
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const toggleLabel = collapsed ? t('expandSidebar') : t('collapseSidebar');

  const renderNavLink = ({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}
      onClick={onNavigate}
    >
      <Icon className={styles.navIcon} aria-hidden="true" />
      <span className={styles.fadeLabel}>{label}</span>
    </NavLink>
  );

  return (
    <aside
      id={SIDEBAR_ID}
      className={styles.sidebar}
      data-collapsed={collapsed}
      data-open={open}
      data-overlay={overlay}
      inert={isMobile && !open}
      aria-label={t('primaryNavigation')}
    >
      <div className={styles.brand}>
        <WorkspaceMenu collapsed={collapsed} onNavigate={onNavigate} />
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('closeSidebar')}>
          <FiX aria-hidden="true" />
        </button>
      </div>

      <span className={cx(styles.sectionLabel, styles.fadeLabel)}>{t('sectionMain')}</span>

      <nav className={styles.nav} aria-busy={loading}>
        {loading
          ? Array.from({ length: NAV_SKELETON_ROWS }, (_, index) => (
            <div key={index} className={styles.navSkeleton} aria-hidden="true">
              <span className={cx(styles.shimmer, styles.navSkeletonIcon)} />
              <span className={cx(styles.shimmer, styles.navSkeletonLabel, styles.fadeLabel)} />
            </div>
          ))
          : mainItems.map(renderNavLink)}
      </nav>

      {!loading && bottomItems.length > 0 && (
        <nav className={styles.navBottom} aria-label={t('nav.settings')}>
          {bottomItems.map(renderNavLink)}
        </nav>
      )}

      <div className={styles.footer}>
        <button
          type="button"
          className={cx(styles.navLink, styles.navLinkDanger)}
          onClick={handleLogout}
          title={collapsed ? t('logout') : undefined}
        >
          <FiLogOut className={styles.navIcon} aria-hidden="true" />
          <span className={styles.fadeLabel}>{t('logout')}</span>
        </button>
        <button
          type="button"
          className={cx(styles.navLink, styles.collapseToggle)}
          onClick={onToggle}
          aria-controls={SIDEBAR_ID}
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          title={collapsed ? toggleLabel : undefined}
        >
          <FiChevronsLeft className={cx(styles.navIcon, styles.toggleIcon)} aria-hidden="true" />
          <span className={styles.fadeLabel} aria-hidden="true">{toggleLabel}</span>
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile tab bar (≤768px) — the first four modules one thumb-tap away, plus
// "More", which opens the full drawer.
// ---------------------------------------------------------------------------

const TAB_BAR_ITEMS = 4;

function MobileTabBar({ items, moreOpen, onMore, onNavigate }) {
  const { t } = useTranslation('sidebar');

  return (
    <nav className={styles.tabBar} aria-label={t('quickNavigation')}>
      {items.slice(0, TAB_BAR_ITEMS).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cx(styles.tab, isActive && styles.tabActive)}
          onClick={onNavigate}
        >
          <Icon className={styles.tabIcon} aria-hidden="true" />
          <span className={styles.tabLabel}>{label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className={cx(styles.tab, moreOpen && styles.tabActive)}
        onClick={onMore}
        aria-controls={SIDEBAR_ID}
        aria-expanded={moreOpen}
      >
        <FiMenu className={styles.tabIcon} aria-hidden="true" />
        <span className={styles.tabLabel}>{t('more')}</span>
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Stats summary bar — today's KPIs for whichever business template this
// tenant runs (gated by the same module dashboard_widgets the Dashboard
// uses). Day-over-day trends are only shown where the backend provides an
// honest yesterday value: the retail sales-trend series (revenue + count).
// ---------------------------------------------------------------------------

const MAX_STATS = 4;
const STATS_REFRESH_MS = 120_000;
const SKELETON_STAT_KEYS = Array.from({ length: MAX_STATS }, (_, index) => `skeleton-${index}`);

// Priority order — the first MAX_STATS this tenant's modules enable win.
const STAT_CANDIDATES = [
  { key: 'todaySales', format: formatCurrency, trendField: 'value' },
  { key: 'todayOrders', format: formatNumber, trendField: 'count' },
  { key: 'todayRevenue', format: formatCurrency },
  { key: 'todaySalesCount', format: formatNumber },
  { key: 'todayCollections', format: formatCurrency },
  { key: 'outstandingBalance', format: formatCurrency },
  { key: 'activeLoans', format: formatNumber },
  { key: 'overdueLoans', format: formatNumber, polarity: 'inverse' },
  { key: 'pendingKitchenOrders', format: formatNumber, polarity: 'inverse' },
  { key: 'occupiedTables', format: formatNumber },
  { key: 'completedOrdersToday', format: formatNumber },
  { key: 'todayRepairs', format: formatNumber },
  { key: 'readyForCollection', format: formatNumber },
  { key: 'inRepairCount', format: formatNumber },
  { key: 'expiringSoonCount', format: formatNumber, polarity: 'inverse' },
  { key: 'monthlySales', format: formatCurrency },
  { key: 'lowStockCount', format: formatNumber, polarity: 'inverse' },
];

function toDayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// The series' `date` arrives either as a plain YYYY-MM-DD string or as a
// serialized local-midnight timestamp — both normalize to a local day key.
function rowDayKey(raw) {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : toDayKey(date);
}

function percentChange(today, yesterday) {
  if (!yesterday) return null;
  const percent = ((today - yesterday) / yesterday) * 100;
  let direction = 'flat';
  if (percent > 0) direction = 'up';
  else if (percent < 0) direction = 'down';
  return { percent, direction };
}

function computeTrends(series) {
  if (!Array.isArray(series)) return {};
  const byDay = new Map(series.map((row) => [rowDayKey(row.date), row]));
  const now = new Date();
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const today = byDay.get(toDayKey(now));
  const yesterday = byDay.get(toDayKey(yesterdayDate));
  return {
    value: percentChange(Number(today?.value) || 0, Number(yesterday?.value) || 0),
    count: percentChange(Number(today?.count) || 0, Number(yesterday?.count) || 0),
  };
}

function useStatsSummary(enabled, needsTrend) {
  const [state, setState] = useState({ kpis: null, trends: {}, loading: true });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const [kpis, series] = await Promise.all([
          dashboardService.getKpis(),
          needsTrend ? dashboardService.getChart('sales-trend', { range: 'week' }).catch(() => null) : Promise.resolve(null),
        ]);
        if (!cancelled) setState({ kpis, trends: computeTrends(series), loading: false });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      }
    };

    load();
    const timer = window.setInterval(load, STATS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, needsTrend]);

  return state;
}

const TREND_TONE_CLASS = {
  positive: styles.trendPositive,
  negative: styles.trendNegative,
  neutral: styles.trendNeutral,
};

function TrendChip({ trend, polarity = 'normal' }) {
  const { t } = useTranslation('dashboard');

  let tone = 'neutral';
  if (trend.direction !== 'flat') {
    const isRise = trend.direction === 'up';
    tone = isRise === (polarity === 'normal') ? 'positive' : 'negative';
  }

  let Icon = FiMinus;
  let sign = '';
  if (trend.direction === 'up') {
    Icon = FiArrowUpRight;
    sign = '+';
  } else if (trend.direction === 'down') {
    Icon = FiArrowDownRight;
    sign = '−';
  }

  return (
    <span className={cx(styles.trend, TREND_TONE_CLASS[tone])}>
      <Icon className={styles.trendIcon} aria-hidden="true" />
      {t('kpi.trendVsYesterday', { percent: `${sign}${Math.abs(trend.percent).toFixed(1)}` })}
    </span>
  );
}

function StatCard({ label, value, trend, polarity }) {
  return (
    <article className={styles.statCard}>
      <p className={styles.statLabel} title={label}>{label}</p>
      <p className={styles.statValue} title={value}>{value}</p>
      {trend ? <TrendChip trend={trend} polarity={polarity} /> : <span className={styles.trendSpacer} aria-hidden="true" />}
    </article>
  );
}

function StatCardSkeleton() {
  return (
    <div className={styles.statCard} aria-hidden="true">
      <span className={cx(styles.shimmer, styles.skeletonLabel)} />
      <span className={cx(styles.shimmer, styles.skeletonValue)} />
      <span className={cx(styles.shimmer, styles.skeletonTrend)} />
    </div>
  );
}

function StatsSummaryBar({ defs, kpis, trends, loading }) {
  const { t } = useTranslation('dashboard');

  return (
    <section className={styles.statsBar} aria-label={t('statsBar')} aria-busy={loading}>
      <div className={styles.statsTrack}>
        {loading
          ? SKELETON_STAT_KEYS.slice(0, defs.length || MAX_STATS).map((key) => <StatCardSkeleton key={key} />)
          : defs.map((def) => (
            <StatCard
              key={def.key}
              label={t(`kpi.${def.key}`)}
              value={kpis && kpis[def.key] !== undefined ? def.format(kpis[def.key]) : '—'}
              trend={def.trendField ? trends[def.trendField] : null}
              polarity={def.polarity}
            />
          ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function MainLayout() {
  const { t } = useTranslation('sidebar');
  const viewport = useViewport();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const { hasWidget, loading: modulesLoading } = useModules();

  const [desktopCollapsed, setDesktopCollapsed] = useState(readStoredCollapsed);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRailExpanded, setIsRailExpanded] = useState(false);

  // Each transient state only means something on its own viewport, so a
  // resize never leaves a stale drawer or overlay behind.
  const drawerOpen = viewport === 'mobile' && isDrawerOpen;
  const railOverlay = viewport === 'tablet' && isRailExpanded;
  let collapsed = false;
  if (viewport === 'desktop') collapsed = desktopCollapsed;
  else if (viewport === 'tablet') collapsed = !railOverlay;

  const closeTransient = useCallback(() => {
    setIsDrawerOpen(false);
    setIsRailExpanded(false);
  }, []);

  // Close-on-navigate for every route change (sidebar link, back/forward,
  // programmatic navigate) — derived during render, not in an effect.
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    if (isDrawerOpen) setIsDrawerOpen(false);
    if (isRailExpanded) setIsRailExpanded(false);
  }

  useEffect(() => {
    writeStoredCollapsed(desktopCollapsed);
  }, [desktopCollapsed]);

  useEffect(() => {
    if (!drawerOpen && !railOverlay) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeTransient();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, railOverlay, closeTransient]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const handleToggle = () => {
    if (viewport === 'desktop') setDesktopCollapsed((prev) => !prev);
    else if (viewport === 'tablet') setIsRailExpanded((prev) => !prev);
  };

  const navigation = useNavigationItems();
  const isFocusRoute = FOCUS_ROUTES.has(location.pathname);
  const showTabBar = viewport === 'mobile' && !isFocusRoute && !navigation.loading && navigation.mainItems.length > 0;

  const canViewDashboard = hasPermission('dashboard.view');
  const salesTrendAvailable = hasWidget('salesTrend');
  const statDefs = STAT_CANDIDATES
    .filter((def) => hasWidget(def.key))
    .slice(0, MAX_STATS)
    .map((def) => (def.trendField && !salesTrendAvailable ? { ...def, trendField: undefined } : def));
  const needsTrend = statDefs.some((def) => def.trendField);

  const stats = useStatsSummary(canViewDashboard && !modulesLoading && statDefs.length > 0, needsTrend);
  const showStats = canViewDashboard && !isFocusRoute && (modulesLoading || statDefs.length > 0);

  return (
    <div className={styles.shell} data-collapsed={viewport === 'desktop' && desktopCollapsed} data-tabbar={showTabBar}>
      <a href="#main-content" className={styles.skipLink}>{t('skipToContent')}</a>

      <div className={styles.overlay} data-visible={drawerOpen || railOverlay} onClick={closeTransient} aria-hidden="true" />

      <Sidebar
        viewport={viewport}
        collapsed={collapsed}
        open={drawerOpen}
        overlay={railOverlay}
        navigation={navigation}
        onNavigate={closeTransient}
        onToggle={handleToggle}
        onClose={closeTransient}
      />

      <div className={styles.topbar}>
        <Navbar onMenuClick={() => setIsDrawerOpen((prev) => !prev)} isOpen={drawerOpen} />
      </div>

      {showStats && (
        <StatsSummaryBar
          defs={statDefs}
          kpis={stats.kpis}
          trends={stats.trends}
          loading={modulesLoading || stats.loading}
        />
      )}

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.content}>
          <PageTransition />
        </div>
      </main>

      {showTabBar && (
        <MobileTabBar
          items={navigation.mainItems}
          moreOpen={drawerOpen}
          onMore={() => setIsDrawerOpen((prev) => !prev)}
          onNavigate={closeTransient}
        />
      )}
    </div>
  );
}

export default MainLayout;
