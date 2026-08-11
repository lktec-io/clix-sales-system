import i18n from '../index';
import pharmacyEn from '../locales/en/pharmacy.json';
import pharmacySw from '../locales/sw/pharmacy.json';

// Side-effect module: registers the 'pharmacy' namespace only when a
// Pharmacy-template page actually loads, instead of shipping it in the
// eager main bundle for every tenant (Retail/Cosmetics/etc. never need it).
// Imported alongside each pharmacy page's own lazy() factory in
// AppRouter.jsx, so registration is guaranteed to finish before the page
// component renders — no async gap, no untranslated-key flash.
i18n.addResourceBundle('en', 'pharmacy', pharmacyEn, true, true);
i18n.addResourceBundle('sw', 'pharmacy', pharmacySw, true, true);
