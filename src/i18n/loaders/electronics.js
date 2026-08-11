import i18n from '../index';
import electronicsEn from '../locales/en/electronics.json';
import electronicsSw from '../locales/sw/electronics.json';

// Side-effect module — see loaders/pharmacy.js for the pattern this follows.
i18n.addResourceBundle('en', 'electronics', electronicsEn, true, true);
i18n.addResourceBundle('sw', 'electronics', electronicsSw, true, true);
