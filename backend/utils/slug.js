// Shared slug generator — used for both tenants.company_code (derived from
// Company Name) and a new tenant's first username (derived from the owner's
// email local-part). Truncated to 40 chars, leaving headroom under
// company_code's VARCHAR(50) for a "-xxxx" collision-retry suffix (see
// tenant.service.js's register()).
export function slugify(text) {
  const slug = String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'account';
}
