// JS mirror of the chart tokens in src/styles/tokens.css — read by the
// hand-rolled DoughnutChart SVG and by pages that pass explicit series
// colours (e.g. Revenue vs Expenses). Recharts components default to the
// --chart-N CSS tokens and need nothing from here. One theme, no orange.
const CHART_PALETTE = {
  primary: '#0F172A',
  primaryHover: '#1E293B',
  accent: '#1E40AF',
  blue: '#2563EB',
  graySecondary: '#64748B',
  border: '#E2E8F0',
  success: '#28A745',
  warning: '#FFC107',
  danger: '#DC3545',
  info: '#2563EB',
  categorical: ['#1E40AF', '#28A745', '#0F172A', '#2563EB', '#94A3B8', '#DC3545'],
  doughnut: ['#1E40AF', '#28A745', '#2563EB', '#0F172A', '#94A3B8', '#64748B', '#CBD5E1'],
  doughnutTrack: '#E2E8F0',
  doughnutOther: '#94A3B8',
  tooltipBg: '#0F172A',
};

export function useChartTheme() {
  return CHART_PALETTE;
}

export const CHART_COLORS = CHART_PALETTE;
export const CATEGORICAL_PALETTE = CHART_PALETTE.categorical;
export const DOUGHNUT_PALETTE = CHART_PALETTE.doughnut;
