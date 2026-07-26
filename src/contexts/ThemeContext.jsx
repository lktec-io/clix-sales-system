import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ThemeContext, THEMES, THEME_IDS } from './themeContextInstance';

const STORAGE_KEY = 'clix-theme';
const DEFAULT_THEME = 'aurora';

function readInitialTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return THEME_IDS.includes(stored) ? stored : DEFAULT_THEME;
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
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (THEME_IDS.includes(next)) setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
