import { useLayoutEffect, useMemo } from 'react';
import { ThemeContext, THEMES } from './themeContextInstance';

const THEME = 'light';
const LEGACY_STORAGE_KEY = 'clix-theme';

// Single fixed theme. data-theme is still stamped on <html> for any
// stylesheet that keys off it, and the old saved theme choice is cleared so
// a returning user can never land on a removed theme.
function ThemeProvider({ children }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', THEME);
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage unavailable — nothing to clear.
    }
  }, []);

  const value = useMemo(() => ({ theme: THEME, setTheme: () => {}, themes: THEMES }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
