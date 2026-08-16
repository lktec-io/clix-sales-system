// A valid Tanzanian mobile number, normalized: country code 255 followed by
// a 6xx/7xx subscriber number (9 digits) — the shape every Tanzanian mobile
// network (Vodacom/Tigo/Airtel/Halotel/TTCL) issues numbers in today.
const TZ_MOBILE_REGEX = /^255[67]\d{8}$/;

// Accepts every common input shape a customer/technician might type or a
// customer record might already hold — 07XXXXXXXX, 06XXXXXXXX,
// 2557XXXXXXXX, 2556XXXXXXXX, +2557XXXXXXXX, +2556XXXXXXXX, or a bare
// 9-digit subscriber number — and normalizes all of them to the single
// "255XXXXXXXXX" shape Beem's API (and any future SMS provider) expects.
// Returns null for anything that isn't a real Tanzanian mobile number,
// rather than guessing — callers must treat null as "do not attempt to
// send," never as "send anyway."
export function normalizeTanzanianPhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return null;

  let normalized;
  if (digits.startsWith('255')) {
    normalized = digits;
  } else if (digits.startsWith('0')) {
    normalized = `255${digits.slice(1)}`;
  } else if (digits.startsWith('6') || digits.startsWith('7')) {
    normalized = `255${digits}`;
  } else {
    normalized = digits;
  }

  return TZ_MOBILE_REGEX.test(normalized) ? normalized : null;
}
