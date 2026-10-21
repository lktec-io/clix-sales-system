import { useTheme } from '../../hooks/useTheme';

// JS mirror of the chart tokens in src/styles/tokens.css — read by the
// hand-rolled DoughnutChart SVG and by pages that pass explicit series
// colours (e.g. Revenue vs Expenses). Recharts components default to the
// --chart-N CSS tokens and need nothing from here.
const THEME_CHART_PALETTES = {
  light: {
    primary: '#0F172A',
    primaryHover: '#1E293B',
    accent: '#F97316',
    blue: '#0284C7',
    graySecondary: '#475569',
    border: '#E2E8F0',
    success: '#10B981',
    warning: '#F97316',
    danger: '#DC2626',
    info: '#0284C7',
    categorical: ['#0F172A', '#F97316', '#10B981', '#0284C7', '#7C3AED', '#DC2626'],
    doughnut: ['#F97316', '#10B981', '#0F172A', '#0284C7', '#7C3AED', '#D97706', '#64748B'],
    doughnutTrack: '#E2E8F0',
    doughnutOther: '#64748B',
    tooltipBg: '#0F172A',
  },
  dark: {
    primary: '#F8FAFC',
    primaryHover: '#E2E8F0',
    accent: '#FB923C',
    blue: '#38BDF8',
    graySecondary: '#A9B6C8',
    border: '#334155',
    success: '#34D399',
    warning: '#FB923C',
    danger: '#F87171',
    info: '#38BDF8',
    categorical: ['#F8FAFC', '#FB923C', '#34D399', '#38BDF8', '#A78BFA', '#F87171'],
    doughnut: ['#FB923C', '#34D399', '#38BDF8', '#A78BFA', '#FBBF24', '#F87171', '#94A3B8'],
    doughnutTrack: '#334155',
    doughnutOther: '#94A3B8',
    tooltipBg: '#F8FAFC',
  },
};

export function useChartTheme() {
  const { theme } = useTheme();
  return THEME_CHART_PALETTES[theme] || THEME_CHART_PALETTES.light;
}

// Fallbacks for non-component contexts that can't call a hook.
export const CHART_COLORS = THEME_CHART_PALETTES.light;
export const CATEGORICAL_PALETTE = THEME_CHART_PALETTES.light.categorical;
export const DOUGHNUT_PALETTE = THEME_CHART_PALETTES.light.doughnut;
