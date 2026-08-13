import { FiCpu, FiDroplet, FiCoffee } from 'react-icons/fi';

// The shared engine for the three business experiences this pass covers
// (Electronics, Cosmetics & Beauty, Restaurant) — layers landing-page and
// dashboard-hero visual identity on top of the existing theme engine
// (Aurora/Midnight/Frost) and business accent system (businessThemes.js),
// never replacing either. Keyed by the same slugs business_templates
// seeds. Copy lives in i18n (landing:businessHero.<slug>.*) so it stays
// translatable; this file only holds the presentation wiring (which CSS
// motif class, which icon) — no business logic, no new backend surface.
//
// Intentionally scoped to exactly these three slugs. Retail/Pharmacy/
// Microfinance keep their existing (accent-only) treatment from
// businessThemes.js — this file is additive, not a replacement for it.
export const BUSINESS_EXPERIENCES = {
  'electronics-shop': {
    motifClass: 'business-motif-electronics',
    icon: FiCpu,
  },
  'cosmetics-shop': {
    motifClass: 'business-motif-cosmetics',
    icon: FiDroplet,
  },
  restaurant: {
    motifClass: 'business-motif-restaurant',
    icon: FiCoffee,
  },
};

export function resolveBusinessExperience(slug) {
  return BUSINESS_EXPERIENCES[slug] || null;
}
