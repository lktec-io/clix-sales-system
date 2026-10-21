import { createContext } from 'react';

export const ThemeContext = createContext(null);

// One production theme — there is no theme switcher. Kept as a context so
// existing consumers (chartTheme.js) keep working unchanged.
export const THEMES = [
  { id: 'light', name: 'Clix', tagline: 'Navy, blue & green' },
];

export const THEME_IDS = THEMES.map((t) => t.id);
