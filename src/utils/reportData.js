// Frontend report plumbing — pure helpers shared by every module report.
// Reports read only existing list endpoints and aggregate in the browser.

const pad2 = (n) => String(n).padStart(2, '0');

// Local calendar day as YYYY-MM-DD.
export function toDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function inRange(value, from, to) {
  const key = toDayKey(value);
  return key !== '' && key >= from && key <= to;
}

// Date-range presets for the report filter bar.
export function presetRange(preset, now = new Date()) {
  const today = toDayKey(now);
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return toDayKey(d);
  };
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: daysAgo(1), to: daysAgo(1) };
    case '7d': return { from: daysAgo(6), to: today };
    case '14d': return { from: daysAgo(13), to: today };
    case '30d': return { from: daysAgo(29), to: today };
    case 'month': return { from: `${today.slice(0, 8)}01`, to: today };
    default: return { from: daysAgo(6), to: today };
  }
}

// Every calendar day in [from, to] — so daily tables show zero days too.
export function eachDay(from, to) {
  const days = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end && days.length < 400) {
    days.push(toDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// Pages through a list endpoint (newest first). `isBeforeRange(row)` stops
// paging as soon as rows fall before the report window. `truncated` is true
// when maxPages was hit before the data ran out — reports say so on screen.
export async function fetchAllPages(fetchPage, { limit = 100, maxPages = 20, isBeforeRange } = {}) {
  const items = [];
  let truncated = false;

  for (let page = 1; ; page += 1) {
    const result = await fetchPage({ page, limit });
    const pageItems = result?.items || [];
    let reachedOlder = false;

    for (const item of pageItems) {
      if (isBeforeRange && isBeforeRange(item)) {
        reachedOlder = true;
        break;
      }
      items.push(item);
    }

    const totalPages = result?.meta?.totalPages ?? page;
    if (reachedOlder || pageItems.length < limit || page >= totalPages) break;
    if (page >= maxPages) {
      truncated = true;
      break;
    }
  }

  return { items, truncated };
}

export const sum = (rows, pick) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

// Group rows by a key and fold each group with `reduce(acc, row)`.
export function groupBy(rows, keyOf, init, reduce) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyOf(row);
    if (!map.has(key)) map.set(key, init(key));
    reduce(map.get(key), row);
  });
  return Array.from(map.values());
}

export const percent = (part, whole) => (whole ? (part / whole) * 100 : 0);

export function formatDuration(hours, t) {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  if (hours < 24) return t('reports:business.duration.hours', { count: Math.round(hours) });
  return t('reports:business.duration.days', { count: Math.round((hours / 24) * 10) / 10 });
}
