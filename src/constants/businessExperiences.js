import {
  FiCpu, FiDroplet, FiCoffee, FiShoppingBag, FiPlusSquare, FiTrendingUp,
} from 'react-icons/fi';

// The shared engine for all six business experiences — layers landing-page
// and dashboard-hero visual identity on top of the existing theme engine
// (Aurora/Midnight/Frost) and business accent system (businessThemes.js),
// never replacing either. Keyed by the same slugs business_templates
// seeds. Copy lives in i18n (landing:businessHero.<slug>.*) so it stays
// translatable; this file only holds the presentation wiring (which CSS
// motif class, which icon) — no business logic, no new backend surface.
export const BUSINESS_EXPERIENCES = {
  'retail-store': {
    motifClass: 'business-motif-retail',
    icon: FiShoppingBag,
  },
  pharmacy: {
    motifClass: 'business-motif-pharmacy',
    icon: FiPlusSquare,
  },
  restaurant: {
    motifClass: 'business-motif-restaurant',
    icon: FiCoffee,
  },
  microfinance: {
    motifClass: 'business-motif-microfinance',
    icon: FiTrendingUp,
  },
  'cosmetics-shop': {
    motifClass: 'business-motif-cosmetics',
    icon: FiDroplet,
  },
  'electronics-shop': {
    motifClass: 'business-motif-electronics',
    icon: FiCpu,
  },
};

export function resolveBusinessExperience(slug) {
  return BUSINESS_EXPERIENCES[slug] || null;
}
