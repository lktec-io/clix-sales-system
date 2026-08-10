import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Every namespace is bundled statically (not fetched over HTTP) — the whole
// translation set is a few dozen KB, far cheaper than a network waterfall on
// every route change. Route-level code splitting (see AppRouter.jsx's
// React.lazy pages) already keeps the JS bundle lazy where it actually
// matters; these JSON dictionaries just ride along with whichever page
// imports them via useTranslation(namespace).
import commonEn from './locales/en/common.json';
import sidebarEn from './locales/en/sidebar.json';
import navbarEn from './locales/en/navbar.json';
import authEn from './locales/en/auth.json';
import landingEn from './locales/en/landing.json';
import registerEn from './locales/en/register.json';
import dashboardEn from './locales/en/dashboard.json';
import productsEn from './locales/en/products.json';
import inventoryEn from './locales/en/inventory.json';
import suppliersEn from './locales/en/suppliers.json';
import purchasesEn from './locales/en/purchases.json';
import customersEn from './locales/en/customers.json';
import salesEn from './locales/en/sales.json';
import returnsEn from './locales/en/returns.json';
import expensesEn from './locales/en/expenses.json';
import reportsEn from './locales/en/reports.json';
import settingsEn from './locales/en/settings.json';
import profileEn from './locales/en/profile.json';
import notificationsEn from './locales/en/notifications.json';
import errorsEn from './locales/en/errors.json';
import billingEn from './locales/en/billing.json';
import microfinanceEn from './locales/en/microfinance.json';

import commonSw from './locales/sw/common.json';
import sidebarSw from './locales/sw/sidebar.json';
import navbarSw from './locales/sw/navbar.json';
import authSw from './locales/sw/auth.json';
import landingSw from './locales/sw/landing.json';
import registerSw from './locales/sw/register.json';
import dashboardSw from './locales/sw/dashboard.json';
import productsSw from './locales/sw/products.json';
import inventorySw from './locales/sw/inventory.json';
import suppliersSw from './locales/sw/suppliers.json';
import purchasesSw from './locales/sw/purchases.json';
import customersSw from './locales/sw/customers.json';
import salesSw from './locales/sw/sales.json';
import returnsSw from './locales/sw/returns.json';
import expensesSw from './locales/sw/expenses.json';
import reportsSw from './locales/sw/reports.json';
import settingsSw from './locales/sw/settings.json';
import profileSw from './locales/sw/profile.json';
import notificationsSw from './locales/sw/notifications.json';
import errorsSw from './locales/sw/errors.json';
import billingSw from './locales/sw/billing.json';
import microfinanceSw from './locales/sw/microfinance.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'sw', label: 'Kiswahili', flag: '🇹🇿' },
];
export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE = 'en';

// Keep in sync with the import list above whenever a namespace is added —
// this is the single place every module's useTranslation(ns) name comes
// from, and also the default namespace resolution order.
export const NAMESPACES = [
  'common', 'sidebar', 'navbar', 'auth', 'landing', 'register', 'dashboard', 'products', 'inventory',
  'suppliers', 'purchases', 'customers', 'sales', 'returns', 'expenses',
  'reports', 'settings', 'profile', 'notifications', 'errors', 'billing', 'microfinance',
];

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: commonEn, sidebar: sidebarEn, navbar: navbarEn, auth: authEn, landing: landingEn, register: registerEn, dashboard: dashboardEn,
      products: productsEn, inventory: inventoryEn, suppliers: suppliersEn,
      purchases: purchasesEn, customers: customersEn, sales: salesEn,
      returns: returnsEn, expenses: expensesEn, reports: reportsEn,
      settings: settingsEn, profile: profileEn, notifications: notificationsEn,
      errors: errorsEn, billing: billingEn, microfinance: microfinanceEn,
    },
    sw: {
      common: commonSw, sidebar: sidebarSw, navbar: navbarSw, auth: authSw, landing: landingSw, register: registerSw, dashboard: dashboardSw,
      products: productsSw, inventory: inventorySw, suppliers: suppliersSw,
      purchases: purchasesSw, customers: customersSw, sales: salesSw,
      returns: returnsSw, expenses: expensesSw, reports: reportsSw,
      settings: settingsSw, profile: profileSw, notifications: notificationsSw,
      errors: errorsSw, billing: billingSw, microfinance: microfinanceSw,
    },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes — double-escaping would mangle interpolated values
  returnEmptyString: false,
  react: { useSuspense: false }, // all resources are bundled synchronously; no loading state ever needed
});

export default i18n;
