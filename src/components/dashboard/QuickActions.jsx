import { useNavigate } from 'react-router-dom';
import {
  FiDollarSign, FiUserPlus, FiCreditCard, FiBarChart2, FiTool, FiShoppingBag, FiTrendingUp, FiCoffee, FiTruck,
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useModules } from '../../hooks/useModules';
import '../../styles/components/QuickActions.css';

// Config-driven, not hardcoded per template: every entry is keyed by the
// real module key (the same string isModuleEnabled() below checks), so
// "which 4 actions does this tenant see" is entirely a function of their
// resolved module list — never a template-name branch. This is what
// closes the bug where every tenant, regardless of business template, saw
// a generic "New Sale -> /pos" card even when the `sales` module was
// disabled for their template (Pharmacy/Restaurant/Microfinance).
//
// ACTION_PRIORITY controls which modules win the (up to) 4 visible slots
// when a tenant has more than 4 of these enabled — earlier entries are
// each business's own flagship/most-frequent action. Retail/Cosmetics
// (sales, customers, expenses, reports enabled; none of the vertical-only
// keys) resolve to exactly the original 4 actions, unchanged. Electronics
// (repairs AND sales both enabled) gets Repair first so it doesn't get
// dominated by the generic Sale action, per spec, while still keeping
// Sale for accessory/parts retail. Microfinance never has `sales` enabled
// at the template level, so "New Sale"/POS can never appear there no
// matter what.
const ACTION_DEFS = {
  repairs: { labelKey: 'newRepair', icon: FiTool, to: '/repairs/new', accent: '#06B6D4' },
  restaurant_orders: { labelKey: 'newOrder', icon: FiCoffee, to: '/restaurant/orders/new', accent: '#F97316' },
  loans: { labelKey: 'newLoan', icon: FiTrendingUp, to: '/loans/new', accent: '#C9A227' },
  pharmacy_sales: { labelKey: 'newSale', icon: FiDollarSign, to: '/pharmacy/sales/new', accent: '#0D9488' },
  sales: { labelKey: 'newSale', icon: FiDollarSign, to: '/pos', accent: '#2F6BFF' },
  menu: { labelKey: 'newMenuItem', icon: FiShoppingBag, to: '/menu/new', accent: '#F97316' },
  pharmacy_purchases: { labelKey: 'receiveStock', icon: FiTruck, to: '/pharmacy/purchases/new', accent: '#10B981' },
  customers: { labelKey: 'newCustomer', icon: FiUserPlus, to: '/customers', accent: '#14B8A6' },
  expenses: { labelKey: 'newExpense', icon: FiCreditCard, to: '/expenses', accent: '#F59E0B' },
  reports: { labelKey: 'reports', icon: FiBarChart2, to: '/reports', accent: '#8B5CF6' },
};
const ACTION_PRIORITY = [
  'repairs', 'restaurant_orders', 'loans', 'pharmacy_sales', 'sales',
  'menu', 'pharmacy_purchases', 'customers', 'expenses', 'reports',
];
const MAX_ACTIONS = 4;

// Same hex->rgb-triple trick KPICard.jsx uses, so the icon wash can be a
// low-opacity rgba() derived from one accent prop instead of a second color.
function hexToRgbTriple(hex) {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function QuickActions() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { isModuleEnabled } = useModules();

  const actions = ACTION_PRIORITY
    .filter((key) => isModuleEnabled(key))
    .slice(0, MAX_ACTIONS)
    .map((key) => ({ key, ...ACTION_DEFS[key] }));

  if (actions.length === 0) return null;

  return (
    <div className="card quick-actions">
      {actions.map(({ key, labelKey, icon: Icon, to, accent }) => (
        <button
          key={key}
          type="button"
          className="quick-actions-item"
          onClick={() => navigate(to)}
          style={{ '--quick-action-accent': accent, '--quick-action-accent-rgb': hexToRgbTriple(accent) }}
        >
          <span className="quick-actions-icon"><Icon aria-hidden="true" /></span>
          <span className="quick-actions-label">{t(`quickActions.${labelKey}`)}</span>
        </button>
      ))}
    </div>
  );
}

export default QuickActions;
