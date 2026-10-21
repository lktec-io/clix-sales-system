import { useTranslation } from 'react-i18next';
import {
  FiGrid, FiUserCheck, FiTruck, FiBox, FiArchive, FiShoppingCart, FiDollarSign, FiRotateCcw,
  FiBarChart2, FiCreditCard, FiSettings, FiMapPin, FiUsers, FiShield, FiBell, FiRepeat, FiClock,
  FiCheckCircle, FiLayers, FiCoffee, FiTool,
} from 'react-icons/fi';
import { useAuth } from './useAuth';
import { useModules } from './useModules';
import { ROUTES } from '../constants/routes';

// Resolves a module registry's `icon` string to the react-icons component —
// the backend sends config, never JSX. Unknown keys fall back to a grid icon.
const ICON_MAP = {
  FiGrid, FiUserCheck, FiTruck, FiBox, FiArchive, FiShoppingCart, FiDollarSign, FiRotateCcw,
  FiBarChart2, FiCreditCard, FiSettings, FiMapPin, FiUsers, FiShield, FiBell, FiRepeat, FiClock,
  FiCheckCircle, FiLayers, FiCoffee, FiTool,
};

function resolveIcon(iconKey) {
  return ICON_MAP[iconKey] || FiGrid;
}

// Single source of navigation for the sidebar, the mobile tab bar and the
// dashboard module switcher. Data-driven from GET /modules/me (this
// tenant's business template + overrides), then narrowed by the user's own
// permissions. A module only becomes a link when it has a `route`; Billing
// is a fixed, permission-gated item anchored with Settings at the bottom.
export function useNavigationItems() {
  const { t } = useTranslation('sidebar');
  const { hasPermission } = useAuth();
  const { modules, loading } = useModules();

  const moduleItems = modules
    .filter((module) => module.route)
    .slice()
    .sort((a, b) => a.navigationOrder - b.navigationOrder)
    .map((module) => ({
      key: module.key,
      to: module.route,
      label: t(`nav.${module.key}`, { defaultValue: module.name }),
      icon: resolveIcon(module.icon),
      end: module.key === 'dashboard',
      requiredPermission: module.requiredPermission ? module.requiredPermission.split(',') : undefined,
    }));

  const billingItem = { key: 'billing', to: ROUTES.BILLING, label: t('nav.billing'), icon: FiCreditCard, requiredPermission: ['company.manage'] };
  const settingsIndex = moduleItems.findIndex((item) => item.to === '/settings/company');

  const mainItems = settingsIndex === -1 ? moduleItems : moduleItems.slice(0, settingsIndex);
  const bottomItems = settingsIndex === -1 ? [billingItem] : [billingItem, ...moduleItems.slice(settingsIndex)];

  const isVisible = (item) => {
    if (!item.requiredPermission) return true;
    return item.requiredPermission.some(hasPermission);
  };

  return {
    loading,
    mainItems: mainItems.filter(isVisible),
    bottomItems: bottomItems.filter(isVisible),
  };
}

export default useNavigationItems;
