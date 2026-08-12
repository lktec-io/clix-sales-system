import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import * as moduleService from '../services/moduleService';
import * as tenantService from '../services/tenantService';
import { useAuth } from '../hooks/useAuth';
import { ModuleContext } from './moduleContextInstance';

// Mirrors CompanyContext.jsx's shape, but — unlike company profile, which
// is meaningful even before login — the enabled-module list is only
// meaningful for an authenticated tenant session, so this fetches on
// isAuthenticated becoming true (not unconditionally on mount) and clears
// on logout, rather than firing a 401 on every public page load.
//
// Also fetches the tenant's business_template slug (via the existing
// GET /tenants/me — see tenant.service.js#getMyTenant) alongside the
// module list — both are functions of the same authenticated tenant row,
// so they load together rather than adding a second effect/fetch cycle.
// businessTemplateSlug drives src/constants/businessThemes.js's accent
// theming; it is never taken from localStorage or any client input, only
// from this server response.
function ModuleProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [modules, setModules] = useState([]);
  const [businessTemplateSlug, setBusinessTemplateSlug] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!isAuthenticated) {
      setModules([]);
      setBusinessTemplateSlug(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([moduleService.getMyModules(), tenantService.getMyTenant()])
      .then(([moduleData, tenantData]) => {
        if (cancelled) return;
        setModules(moduleData);
        setBusinessTemplateSlug(tenantData.businessTemplateSlug || null);
      })
      .catch(() => {
        // Dynamic nav/dashboard/theming degrade gracefully to "nothing
        // extra shown" rather than breaking the app — never a reason to
        // block rendering.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    return load();
  }, [load]);

  // Same data-attribute pattern ThemeContext.jsx uses for data-theme —
  // src/styles/businessThemes.css reads this to apply the tenant's accent
  // tokens. useLayoutEffect so it's set before paint, avoiding a flash of
  // the default (no-accent) look on load. Cleared to null (removing the
  // attribute) rather than left stale whenever there's no resolved
  // template yet (logged out, or a slug outside the six active templates).
  useLayoutEffect(() => {
    if (businessTemplateSlug) {
      document.documentElement.setAttribute('data-business-template', businessTemplateSlug);
    } else {
      document.documentElement.removeAttribute('data-business-template');
    }
  }, [businessTemplateSlug]);

  const isModuleEnabled = useCallback((key) => modules.some((module) => module.key === key), [modules]);
  const hasWidget = useCallback(
    (widgetKey) => modules.some((module) => Array.isArray(module.dashboardWidgets) && module.dashboardWidgets.includes(widgetKey)),
    [modules],
  );

  const value = useMemo(
    () => ({ modules, businessTemplateSlug, loading, isModuleEnabled, hasWidget, refetch: load }),
    [modules, businessTemplateSlug, loading, isModuleEnabled, hasWidget, load],
  );

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export default ModuleProvider;
