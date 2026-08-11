import i18n from '../index';
import microfinanceEn from '../locales/en/microfinance.json';
import microfinanceSw from '../locales/sw/microfinance.json';

// Side-effect module — see loaders/pharmacy.js for the pattern this follows.
i18n.addResourceBundle('en', 'microfinance', microfinanceEn, true, true);
i18n.addResourceBundle('sw', 'microfinance', microfinanceSw, true, true);
