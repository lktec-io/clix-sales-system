import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as platformAuthService from '../services/platformAuthService';
import { setPlatformAccessToken, clearPlatformAccessToken } from '../utils/platformTokenStorage';
import { setOnPlatformSessionExpired } from '../services/platformApiClient';
import { PlatformAuthContext } from './platformAuthContextInstance';

// Structurally identical to AuthContext.jsx, deliberately — but zero
// shared imports with it besides pure, tenant-agnostic utilities. A
// platform admin session and a tenant session are two fully independent
// pieces of React state, backed by two independent token stores and two
// independent axios clients (platformApiClient vs apiClient).
function PlatformAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const restoreSupersededRef = useRef(false);

  useEffect(() => {
    setOnPlatformSessionExpired(() => {
      setAdmin(null);
      setSessionExpired(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const { accessToken, admin: restoredAdmin } = await platformAuthService.refresh();
        if (cancelled || restoreSupersededRef.current) return;
        setPlatformAccessToken(accessToken);
        setAdmin(restoredAdmin);
      } catch {
        if (!cancelled && !restoreSupersededRef.current) clearPlatformAccessToken();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    restoreSupersededRef.current = true;
    const result = await platformAuthService.login({ email, password });
    setPlatformAccessToken(result.accessToken);
    setAdmin(result.admin);
    setSessionExpired(false);
    return result.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await platformAuthService.logout();
    } finally {
      clearPlatformAccessToken();
      setAdmin(null);
    }
  }, []);

  const acknowledgeSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value = useMemo(
    () => ({
      admin,
      isAuthenticated: Boolean(admin),
      initializing,
      sessionExpired,
      login,
      logout,
      acknowledgeSessionExpired,
    }),
    [admin, initializing, sessionExpired, login, logout, acknowledgeSessionExpired],
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export default PlatformAuthProvider;
