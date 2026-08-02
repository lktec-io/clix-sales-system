import { DICTIONARIES, DEFAULT_LOCALE } from './dictionaries.js';

export function resolveLocale(input) {
  return input === 'sw' ? 'sw' : DEFAULT_LOCALE;
}

// Dot-path lookup ('receipt.thankYou') against the requested locale's
// dictionary, falling back to English for a missing key rather than
// throwing — a document must still render if a translation is momentarily
// incomplete. {{var}} interpolation only (no plurals/formatting needed for
// the small, mostly-static string set these documents use).
export function t(locale, key, vars = {}) {
  const dict = DICTIONARIES[resolveLocale(locale)] || DICTIONARIES[DEFAULT_LOCALE];
  const fallback = DICTIONARIES[DEFAULT_LOCALE];
  const fromPath = (source) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), source);

  const raw = fromPath(dict) ?? fromPath(fallback) ?? key;
  return String(raw).replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] ?? ''));
}
