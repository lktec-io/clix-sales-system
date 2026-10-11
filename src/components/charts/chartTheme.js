import { useTheme } from '../../hooks/useTheme';

// Legacy JS palette mirroring src/styles/themes.css — still read by the
// hand-rolled DoughnutChart SVG and by pages that pass explicit series
// colours. The Recharts components (LineChart, BarChart,
// CustomerTrafficChart) default to the --chart-N CSS tokens instead and
// need nothing from here.
const THEME_CHART_PALETTES = {
  aurora: {
    primary: '#0B1F4D',
    primaryHover: '#123262',
    accent: '#10B981',
    blue: '#2F6BFF',
    graySecondary: '#5B6B8C',
    border: 'rgba(15, 23, 42, 0.1)',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#2F6BFF',
    categorical: ['#0B1F4D', '#2F6BFF', '#10B981', '#F59E0B', '#334155', '#EF4444'],
    doughnut: ['#2F6BFF', '#10B981', '#C89B3C', '#22D3EE', '#F59E0B', '#8B5CF6', '#14B8A6'],
    doughnutTrack: 'rgba(15, 23, 42, 0.1)',
    doughnutOther: '#5B6B8C',
    tooltipBg: 'rgba(11, 31, 77, 0.92)',
  },
  midnight: {
    primary: '#3B9EFF',
    primaryHover: '#2B84E0',
    accent: '#22D3EE',
    blue: '#10B981',
    graySecondary: '#8B93A7',
    border: 'rgba(148, 178, 220, 0.12)',
    success: '#10B981',
    warning: '#FFD166',
    danger: '#FF4D6D',
    info: '#22D3EE',
    categorical: ['#3B9EFF', '#22D3EE', '#10B981', '#FFD166', '#818CF8', '#FF4D6D'],
    doughnut: ['#3B9EFF', '#22D3EE', '#10B981', '#818CF8', '#FFD166', '#5EEAD4', '#FF4D6D'],
    doughnutTrack: 'rgba(148, 178, 220, 0.12)',
    doughnutOther: '#8B93A7',
    tooltipBg: 'rgba(8, 18, 31, 0.94)',
  },
  frost: {
    primary: '#2952CC',
    primaryHover: '#1F3FA0',
    accent: '#0E9488',
    blue: '#2952CC',
    graySecondary: '#6B7280',
    border: 'rgba(15, 23, 42, 0.08)',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#2952CC',
    categorical: ['#2952CC', '#0E9488', '#94A3B8', '#C9A15A', '#DC2626', '#3F4756'],
    doughnut: ['#2952CC', '#0E9488', '#C9A15A', '#94A3B8', '#D97706', '#7C8FBF', '#DC2626'],
    doughnutTrack: 'rgba(15, 23, 42, 0.08)',
    doughnutOther: '#6B7280',
    tooltipBg: 'rgba(30, 36, 48, 0.92)',
  },
};

// The single hook every chart component (BarChart/LineChart/DoughnutChart)
// and every page passing an explicit `color`/dataset color reads from —
// swapping themes re-renders these with the new palette, no chart-specific
// wiring needed per caller.
export function useChartTheme() {
  const { theme } = useTheme();
  return THEME_CHART_PALETTES[theme] || THEME_CHART_PALETTES.aurora;
}

// Default/fallback exports for any non-component context that can't call a
// hook — always Aurora. Live chart components must use useChartTheme().
export const CHART_COLORS = THEME_CHART_PALETTES.aurora;
export const CATEGORICAL_PALETTE = THEME_CHART_PALETTES.aurora.categorical;
export const DOUGHNUT_PALETTE = THEME_CHART_PALETTES.aurora.doughnut;
