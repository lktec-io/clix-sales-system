import i18n from '../index';
import restaurantEn from '../locales/en/restaurant.json';
import restaurantSw from '../locales/sw/restaurant.json';

// Side-effect module — see loaders/pharmacy.js for the pattern this follows.
i18n.addResourceBundle('en', 'restaurant', restaurantEn, true, true);
i18n.addResourceBundle('sw', 'restaurant', restaurantSw, true, true);
