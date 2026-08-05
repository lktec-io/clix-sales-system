export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  SESSION_EXPIRED: '/session-expired',

  DASHBOARD: '/dashboard',
  SETTINGS_COMPANY: '/settings/company',

  UNAUTHORIZED: '/401',
  FORBIDDEN: '/403',
  NOT_FOUND: '/404',
  SERVER_ERROR: '/500',
};

// Phase 3 — Clix SaaS Owner Portal. A fully separate route namespace from
// ROUTES above; PlatformProtectedRoute/PlatformAuthContext never reference
// ROUTES, and this app's tenant router never references PLATFORM_ROUTES.
export const PLATFORM_ROUTES = {
  LOGIN: '/platform/login',
  DASHBOARD: '/platform/dashboard',
  TENANTS: '/platform/tenants',
  AUDIT_LOG: '/platform/audit-log',
  NOTIFICATIONS: '/platform/notifications',
  SETTINGS: '/platform/settings',
};
