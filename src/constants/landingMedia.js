// Landing page media — every file is served locally from public/assets (no
// hotlinking). Sources and licences are listed in public/assets/CREDITS.md;
// all are free to use (Unsplash License / Pexels License), credits shown on
// the page as a courtesy.

const businessImage = (slug, credit) => ({
  src: `/assets/images/business-${slug}-800.webp`,
  srcSet: `/assets/images/business-${slug}-480.webp 480w, /assets/images/business-${slug}-800.webp 800w`,
  credit,
});

export const HERO_PORTRAIT = {
  src: '/assets/images/hero-merchant.webp',
  width: 900,
  height: 1100,
  credit: { name: 'Ali Mkumbwa', url: 'https://unsplash.com/@mkumbwajr', site: 'Unsplash' },
};

// Keyed by business_templates slug.
export const BUSINESS_PHOTOS = {
  'retail-store': businessImage('retail-store', { name: 'Ali Mkumbwa', url: 'https://unsplash.com/@mkumbwajr', site: 'Unsplash' }),
  pharmacy: businessImage('pharmacy', { name: 'National Cancer Institute', url: 'https://unsplash.com/@nci', site: 'Unsplash' }),
  restaurant: businessImage('restaurant', { name: 'Owen Bruce', url: 'https://unsplash.com/@wenography', site: 'Unsplash' }),
  microfinance: businessImage('microfinance', { name: 'Ali Mkumbwa', url: 'https://unsplash.com/@mkumbwajr', site: 'Unsplash' }),
  'cosmetics-shop': businessImage('cosmetics-shop', { name: 'Praise Judah', url: 'https://unsplash.com/@pjayth3kreator', site: 'Unsplash' }),
  'electronics-shop': businessImage('electronics-shop', { name: 'Clint Bustrillos', url: 'https://unsplash.com/@clintbustrillos', site: 'Unsplash' }),
};

// A cashier ringing up a sale at a POS counter (8-second loop).
export const HERO_VIDEO = {
  sources: [
    { src: '/assets/videos/demo-sales-720.mp4', type: 'video/mp4', media: '(min-width: 768px)' },
    { src: '/assets/videos/demo-sales-540.mp4', type: 'video/mp4' },
  ],
  poster: '/assets/images/demo-sales-poster.webp',
  credit: { name: 'Kampus Production', url: 'https://www.pexels.com/@kampus/', site: 'Pexels' },
};
