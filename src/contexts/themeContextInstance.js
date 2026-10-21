import { createContext } from 'react';

export const ThemeContext = createContext(null);

// Metadata drives the picker popup's preview cards and the chart-colour
// hook (chartTheme.js). Swatches mirror the tokens in src/styles/tokens.css.
export const THEMES = [
  {
    id: 'light',
    name: 'Light',
    tagline: 'Navy & orange on a soft canvas',
    preview: {
      pageBg: '#F8FAFC',
      sidebarFrom: '#0F172A',
      sidebarTo: '#0F172A',
      navbarBg: '#F8FAFC',
      cardBg: '#FFFFFF',
      textOnSidebar: '#A9B6C8',
      primary: '#0F172A',
      accent: '#F97316',
      chart: ['#059669', '#475569', '#0284C7', '#D97706'],
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    tagline: 'Low-light night shifts',
    preview: {
      pageBg: '#0F172A',
      sidebarFrom: '#020617',
      sidebarTo: '#020617',
      navbarBg: '#0F172A',
      cardBg: '#1E293B',
      textOnSidebar: '#A9B6C8',
      primary: '#F8FAFC',
      accent: '#F97316',
      chart: ['#34D399', '#94A3B8', '#38BDF8', '#FBBF24'],
    },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

// Theme ids saved before the redesign, mapped onto the new pair.
export const LEGACY_THEME_MAP = { aurora: 'light', frost: 'light', midnight: 'dark' };
