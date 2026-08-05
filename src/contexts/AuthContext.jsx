import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as authService from '../services/authService';
import * as tenantService from '../services/tenantService';
import { setAccessToken, clearAccessToken } from '../utils/tokenStorage';
import { setOnSessionExpired } from '../services/apiClient';
import { AuthContext } from './authContextInstance';

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Guards against a race between the mount-time silent /auth/refresh below
  // and an explicit login(): if the user submits the login form before that
  // refresh call resolves, its response can land AFTER login's and clobber
  // (or clear) the token/user login just set — causing the very next
  // authenticated request (e.g. the Navbar's unread-count poll) to fail with
  // a stale or missing token. Setting this synchronously at the start of
  // login() makes restoreSession's callback a no-op if login has begun.
  const restoreSupersededRef = useRef(false);

  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      setSessionExpired(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const { accessToken, user: restoredUser } = await authService.refresh();
        if (cancelled || restoreSupersededRef.current) return;
        setAccessToken(accessToken);
        setUser(restoredUser);
      } catch {
        if (!cancelled && !restoreSupersededRef.current) clearAccessToken();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ identifier, password, rememberMe }) => {
    restoreSupersededRef.current = true;
    const result = await authService.login({ identifier, password, rememberMe });
    setAccessToken(result.accessToken);
    setUser(result.user);
    setSessionExpired(false);
    return result.user;
  }, []);

  // Self-registration auto-login — the backend returns the identical
  // { accessToken, user } shape /auth/login does (same issueTokensForUser()
  // call, same refresh cookie), so this is a near-copy of login() above,
  // not new logic.
  const register = useCallback(async (payload) => {
    restoreSupersededRef.current = true;
    const result = await tenantService.register(payload);
    setAccessToken(result.accessToken);
    setUser(result.user);
    setSessionExpired(false);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearAccessToken();
      setUser(null);
    }
  }, []);

  const acknowledgeSessionExpired = useCallback(() => setSessionExpired(false), []);

  // Lets Profile updates (name, avatar) reflect immediately in the Navbar
  // and anywhere else `user` is read, without a full session refresh.
  const updateUser = useCallback((updatedUser) => setUser(updatedUser), []);

  const hasPermission = useCallback(
    (code) => Boolean(user?.permissions?.includes(code)),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      initializing,
      sessionExpired,
      login,
      register,
      logout,
      acknowledgeSessionExpired,
      hasPermission,
      updateUser,
    }),
    [user, initializing, sessionExpired, login, register, logout, acknowledgeSessionExpired, hasPermission, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
