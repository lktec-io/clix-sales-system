import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ThemeContext, THEMES, THEME_IDS, LEGACY_THEME_MAP } from './themeContextInstance';

const STORAGE_KEY = 'clix-theme';
const DEFAULT_THEME = 'light';

function readInitialTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  let stored;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_THEME;
  }
  if (THEME_IDS.includes(stored)) return stored;
  return LEGACY_THEME_MAP[stored] || DEFAULT_THEME;
}

function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitialTheme);

  // useLayoutEffect (not useEffect) — applies the data-theme attribute
  // synchronously before the browser paints, so a reload never flashes the
  // default theme before swapping to the persisted one.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (private mode / blocked) — theme just won't persist.
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (THEME_IDS.includes(next)) setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
