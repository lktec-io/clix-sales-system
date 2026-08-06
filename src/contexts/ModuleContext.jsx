import { useCallback, useEffect, useMemo, useState } from 'react';
import * as moduleService from '../services/moduleService';
import { useAuth } from '../hooks/useAuth';
import { ModuleContext } from './moduleContextInstance';

// Mirrors CompanyContext.jsx's shape, but — unlike company profile, which
// is meaningful even before login — the enabled-module list is only
// meaningful for an authenticated tenant session, so this fetches on
// isAuthenticated becoming true (not unconditionally on mount) and clears
// on logout, rather than firing a 401 on every public page load.
function ModuleProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!isAuthenticated) {
      setModules([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    moduleService.getMyModules()
      .then((data) => {
        if (!cancelled) setModules(data);
      })
      .catch(() => {
        // Dynamic nav/dashboard degrade gracefully to "nothing extra shown"
        // rather than breaking the app — never a reason to block rendering.
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

  const isModuleEnabled = useCallback((key) => modules.some((module) => module.key === key), [modules]);
  const hasWidget = useCallback(
    (widgetKey) => modules.some((module) => Array.isArray(module.dashboardWidgets) && module.dashboardWidgets.includes(widgetKey)),
    [modules],
  );

  const value = useMemo(
    () => ({ modules, loading, isModuleEnabled, hasWidget, refetch: load }),
    [modules, loading, isModuleEnabled, hasWidget, load],
  );

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export default ModuleProvider;
