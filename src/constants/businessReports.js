import { FiShoppingBag, FiDroplet, FiTool, FiCoffee, FiTrendingUp, FiPlusSquare } from 'react-icons/fi';

// Which module report each tenant gets: the module that must be enabled for
// the tenant's business template, and the permission needed to read its data.
// Cosmetics shares the Retail sales tables, so it is the Retail report with
// the cosmetics stock view switched on (decided by template slug).
export const BUSINESS_REPORTS = [
  { key: 'retail', module: 'sales', permission: 'sales.view', icon: FiShoppingBag },
  { key: 'cosmetics', module: 'sales', permission: 'sales.view', icon: FiDroplet, template: 'cosmetics-shop' },
  { key: 'repair', module: 'repairs', permission: 'repairs.view', icon: FiTool },
  { key: 'restaurant', module: 'restaurant_orders', permission: 'restaurant_orders.view', icon: FiCoffee },
  { key: 'loans', module: 'loans', permission: 'loans.view', icon: FiTrendingUp },
  { key: 'pharmacy', module: 'medicines', permission: 'medicines.view', icon: FiPlusSquare },
];

export function availableBusinessReports({ isModuleEnabled, hasPermission, businessTemplateSlug }) {
  const isCosmetics = businessTemplateSlug === 'cosmetics-shop';
  return BUSINESS_REPORTS.filter((report) => {
    if (!isModuleEnabled(report.module) || !hasPermission(report.permission)) return false;
    if (report.key === 'retail') return !isCosmetics;
    if (report.key === 'cosmetics') return isCosmetics;
    return true;
  });
}

export const BUSINESS_REPORTS_ROUTE = '/business-reports';
