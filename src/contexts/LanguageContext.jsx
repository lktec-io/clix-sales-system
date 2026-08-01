import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import i18n, { SUPPORTED_LANGUAGES, LANGUAGE_CODES, DEFAULT_LANGUAGE } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import * as authService from '../services/authService';
import { LanguageContext } from './languageContextInstance';

const STORAGE_KEY = 'clix-language';

function readInitialLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return LANGUAGE_CODES.includes(stored) ? stored : DEFAULT_LANGUAGE;
}

function LanguageProvider({ children }) {
  const { user, isAuthenticated, updateUser } = useAuth();
  const toast = useToast();
  const [language, setLanguageState] = useState(readInitialLanguage);

  // useLayoutEffect (not useEffect) — mirrors ThemeProvider's data-theme
  // handling: applies before the browser paints, so a reload never flashes
  // one language before swapping to the persisted one.
  useLayoutEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  // Once the authenticated user's server-stored preference is known, it
  // wins over whatever localStorage guessed on this device — this is what
  // makes the language follow the account across devices/browsers, with
  // localStorage only acting as the pre-login / offline-first guess.
  useEffect(() => {
    if (isAuthenticated && user?.preferred_language && LANGUAGE_CODES.includes(user.preferred_language)) {
      setLanguageState((current) => (current === user.preferred_language ? current : user.preferred_language));
    }
  }, [isAuthenticated, user?.preferred_language]);

  const setLanguage = useCallback(async (next) => {
    if (!LANGUAGE_CODES.includes(next)) return;
    setLanguageState(next); // instant, in-memory switch — no reload, no wait on the network call below
    if (isAuthenticated) {
      try {
        const updated = await authService.updateLanguage(next);
        updateUser(updated);
      } catch {
        toast.error(i18n.t('profile:language.syncError'));
      }
    }
  }, [isAuthenticated, updateUser, toast]);

  const value = useMemo(() => ({ language, setLanguage, languages: SUPPORTED_LANGUAGES }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export default LanguageProvider;
