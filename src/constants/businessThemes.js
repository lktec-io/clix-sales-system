import {
  FiShoppingBag, FiPlusSquare, FiCoffee, FiTrendingUp, FiDroplet, FiCpu,
} from 'react-icons/fi';

// One restrained accent color + icon per active business template — NOT a
// full re-skin (Section 8 is explicit: no six separate apps, no excessive
// color). This drives a handful of small, deliberate identity touches
// (Sidebar brand mark, Dashboard header chip, KPICard's default icon
// accent) layered on top of whichever Aurora/Midnight/Frost theme
// (src/styles/themes.css) the user has chosen — it never overrides the
// page's actual color scheme.
//
// Keyed by the exact slugs business_templates seeds
// (026_create_module_framework_tables.sql / 034_finalize_template_scope_
// and_electronics_repairs.sql) — the six FINAL active templates only.
// Archived templates (wholesale-store, hardware-store, clothing-store,
// general-business, school, saccos) intentionally have no entry; a tenant
// can never be assigned one at signup, so DEFAULT_BUSINESS_THEME below is
// the correct fallback for any slug not listed here, not a sign this map
// is incomplete.
export const BUSINESS_THEMES = {
  // Emerald — paired with the shared dark navy hero base for a "navy +
  // emerald" retail identity; fast/clean/inventory-driven.
  'retail-store': { accent: '#059669', accentRgb: '5, 150, 105', icon: FiShoppingBag, label: 'Retail' },
  // Professional teal (Tailwind teal-600) — clean, trustworthy retail-
  // pharmacy identity without leaning on clinical/hospital blue imagery.
  pharmacy: { accent: '#0D9488', accentRgb: '13, 148, 136', icon: FiPlusSquare, label: 'Pharmacy' },
  restaurant: { accent: '#F97316', accentRgb: '249, 115, 22', icon: FiCoffee, label: 'Restaurant' },
  // Gold — paired with the shared deep-navy hero base for a "deep blue +
  // gold" financial-institution identity; premium/authoritative.
  microfinance: { accent: '#C9A227', accentRgb: '201, 162, 39', icon: FiTrendingUp, label: 'Microfinance' },
  'cosmetics-shop': { accent: '#EC4899', accentRgb: '236, 72, 153', icon: FiDroplet, label: 'Cosmetics & Beauty' },
  'electronics-shop': { accent: '#06B6D4', accentRgb: '6, 182, 212', icon: FiCpu, label: 'Electronics & Repairs' },
};

export const DEFAULT_BUSINESS_THEME = { accent: null, accentRgb: null, icon: FiShoppingBag, label: null };

export function resolveBusinessTheme(slug) {
  return BUSINESS_THEMES[slug] || DEFAULT_BUSINESS_THEME;
}
