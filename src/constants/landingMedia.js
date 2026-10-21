// Real photos and video for the public landing page. Every asset below was
// checked by hand: free licence (Unsplash License / Pexels License — no
// Unsplash+ premium images), real people in real businesses, and the URL
// returns the actual file. Credits are shown on the page.

const unsplash = (photoId, width) => `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=72`;

function unsplashImage(photoId, credit) {
  return {
    src: unsplash(photoId, 800),
    srcSet: [480, 800, 1200].map((w) => `${unsplash(photoId, w)} ${w}w`).join(', '),
    credit,
  };
}

// Keyed by business_templates slug.
export const BUSINESS_PHOTOS = {
  'retail-store': unsplashImage('1687422808311-a776f467a468', {
    name: 'Ali Mkumbwa', url: 'https://unsplash.com/@mkumbwajr', site: 'Unsplash', place: 'Dar es Salaam, Tanzania',
  }),
  pharmacy: unsplashImage('1576091358783-a212ec293ff3', {
    name: 'National Cancer Institute', url: 'https://unsplash.com/@nci', site: 'Unsplash',
  }),
  restaurant: unsplashImage('1610851467843-fe4a65aea9c0', {
    name: 'Owen Bruce', url: 'https://unsplash.com/@wenography', site: 'Unsplash',
  }),
  microfinance: unsplashImage('1718010567947-4478d86294dc', {
    name: 'Ali Mkumbwa', url: 'https://unsplash.com/@mkumbwajr', site: 'Unsplash', place: 'Dar es Salaam, Tanzania',
  }),
  'cosmetics-shop': unsplashImage('1762745103094-6760fab8eb50', {
    name: 'Praise Judah', url: 'https://unsplash.com/@pjayth3kreator', site: 'Unsplash',
  }),
  'electronics-shop': unsplashImage('1550041473-d296a3a8a18a', {
    name: 'Clint Bustrillos', url: 'https://unsplash.com/@clintbustrillos', site: 'Unsplash',
  }),
};

// A cashier ringing up a sale at a real POS counter (8s loop).
export const HERO_VIDEO = {
  sources: [
    { src: 'https://videos.pexels.com/video-files/8421356/8421356-hd_1280_720_25fps.mp4', type: 'video/mp4', media: '(min-width: 768px)' },
    { src: 'https://videos.pexels.com/video-files/8421356/8421356-sd_960_540_25fps.mp4', type: 'video/mp4' },
  ],
  poster: 'https://images.pexels.com/videos/8421356/pexels-photo-8421356.jpeg?auto=compress&w=1280',
  credit: { name: 'Kampus Production', url: 'https://www.pexels.com/@kampus/', site: 'Pexels' },
};
