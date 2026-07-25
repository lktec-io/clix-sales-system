import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { logger } from '../config/logger.js';
import { resolveConfig, formatCell, humanize, MONEY_KEYS } from './reportConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const MM_TO_PT = 2.83465;
const mm = (value) => value * MM_TO_PT;

const PAGE_MARGIN = mm(15);
const CONTENT_WIDTH = mm(210) - PAGE_MARGIN * 2;

// JOZZY brand palette — Navy / Emerald / Gold, matching the app's own
// design tokens (src/styles/colors.css: --color-primary, --color-accent,
// --color-gold) so the exported document reads as the same brand as the
// live app rather than a generic gray report template. pdfkit has no
// Poppins available server-side (no local .ttf shipped in this repo and
// this environment can't fetch one) — Helvetica-Bold/Helvetica is the
// closest built-in stand-in and is what's used throughout.
const COLOR_NAVY = '#0B1F4D';
const COLOR_EMERALD = '#10B981';
const COLOR_GOLD = '#C8A56A';
const COLOR_MUTED = '#64748B';
const COLOR_BORDER = '#E2E8F0';
const COLOR_ROW_ALT = '#F8FAFC';
const COLOR_WHITE = '#FFFFFF';
const COLOR_WARNING = '#F59E0B';
const COLOR_DANGER = '#EF4444';
const COLOR_LIGHT_GRAY = '#F1F5F9';

// A small, fixed rotation of card accent colors — same idea as the
// on-screen KPICard's per-metric accent, so "Total Revenue" and "Net
// Profit" don't all read as one flat navy block.
const KPI_ACCENTS = [COLOR_EMERALD, COLOR_NAVY, COLOR_GOLD, '#3B82F6', COLOR_WARNING, COLOR_DANGER, '#8B5CF6'];

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > doc.page.height - PAGE_MARGIN - mm(10)) {
    doc.addPage();
  }
}

// pdfkit's standard 14 fonts (Helvetica included — no embedded Poppins is
// available, see the note above) only support WinAnsiEncoding, a Latin-1
// superset. Characters outside it — the analysis engine's "→" between
// revenue figures being the one this repo's own text actually produces —
// render as garbled glyphs instead of throwing, which is easy to miss
// without opening the actual PDF (exactly how this was caught: the
// on-screen/Excel/CSV renderers all handle full Unicode fine, so the
// shared analysis/recommendations strings keep the nicer glyph everywhere
// except here, where it's swapped for a safe equivalent right before
// rendering).
function sanitizeForPdf(text) {
  return String(text)
    .replace(/→/g, '->')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function divider(doc, color = COLOR_BORDER) {
  doc.moveDown(0.3);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y).strokeColor(color).stroke();
  doc.moveDown(0.3);
}

function sectionTitle(doc, text) {
  ensureSpace(doc, mm(14));
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLOR_NAVY).text(text, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
}

// Only handles a locally-stored logo (logo_path starting with "/uploads/");
// a Cloudinary-hosted logo is a remote URL and would need an async fetch to
// embed, which isn't worth the extra request/failure surface for a PDF
// header image — those deployments simply get the text-only header, same
// as if no logo were configured at all.
function resolveLocalLogoPath(logoPath) {
  if (!logoPath || !logoPath.startsWith('/uploads/')) return null;
  const absPath = path.join(UPLOADS_ROOT, logoPath.replace('/uploads/', ''));
  return fs.existsSync(absPath) ? absPath : null;
}

// Joins whatever address parts company_settings actually has filled in —
// street/district/region are all optional columns, so this never prints
// literal "null" or a run of empty commas for a company that hasn't filled
// every field in.
function formatCompanyAddress(company) {
  return [company?.street, company?.district, company?.region].filter(Boolean).join(', ');
}

// The full header — logo, company identity, report title, generated-by,
// filters — drawn once on page 1 only. Every subsequent page gets the
// lighter drawCompactHeader below via the 'pageAdded' event instead, so a
// 5-page report doesn't repeat the full logo block 5 times.
function drawFullHeader(doc, { config, dateRangeLabel, company, generatedByName, filtersLabel, branchLabel }) {
  const logoPath = resolveLocalLogoPath(company?.logo_path);
  const textLeft = PAGE_MARGIN + (logoPath ? mm(22) : 0);

  if (logoPath) {
    try {
      doc.image(logoPath, PAGE_MARGIN, doc.y, { width: mm(18) });
    } catch (err) {
      logger.warn('Report PDF: failed to embed company logo, falling back to text-only header', { error: err.message });
    }
  }

  const headerTop = doc.y;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLOR_MUTED)
    .text(company?.company_name || 'JOZZY SALES MANAGEMENT SYSTEM', textLeft, headerTop, { width: CONTENT_WIDTH - (textLeft - PAGE_MARGIN) });

  const addressLine = formatCompanyAddress(company);
  const contactLine = [company?.phone, company?.email].filter(Boolean).join(' · ');
  if (addressLine) {
    doc.fontSize(7).font('Helvetica').fillColor(COLOR_MUTED)
      .text(addressLine, textLeft, doc.y, { width: CONTENT_WIDTH - (textLeft - PAGE_MARGIN) });
  }
  if (contactLine) {
    doc.fontSize(7).font('Helvetica').fillColor(COLOR_MUTED)
      .text(contactLine, textLeft, doc.y, { width: CONTENT_WIDTH - (textLeft - PAGE_MARGIN) });
  }

  doc.fontSize(17).font('Helvetica-Bold').fillColor(COLOR_NAVY)
    .text(`${config.title} Report`, textLeft, doc.y + mm(1.5), { width: CONTENT_WIDTH - (textLeft - PAGE_MARGIN) });
  doc.fontSize(9).font('Helvetica').fillColor(COLOR_MUTED)
    .text(dateRangeLabel, textLeft, doc.y, { width: CONTENT_WIDTH - (textLeft - PAGE_MARGIN) });

  doc.y = Math.max(doc.y, headerTop + mm(22));
  doc.x = PAGE_MARGIN;

  doc.fontSize(8).font('Helvetica').fillColor(COLOR_MUTED);
  const metaParts = [];
  if (generatedByName) metaParts.push(`Generated by: ${generatedByName} on ${new Date().toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' })}`);
  if (branchLabel) metaParts.push(`Branch: ${branchLabel}`);
  metaParts.forEach((line) => doc.text(line, { width: CONTENT_WIDTH }));
  if (filtersLabel) {
    doc.text(`Filters: ${filtersLabel}`, { width: CONTENT_WIDTH });
  }
  doc.fillColor(COLOR_NAVY);

  divider(doc, COLOR_GOLD);
}

// The repeated per-page header — company name + report title only, one
// line, so it never eats meaningfully into content space on pages 2+.
function drawCompactHeader(doc, { config, company }) {
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_NAVY)
    .text(company?.company_name || 'JOZZY Sales Management System', PAGE_MARGIN, PAGE_MARGIN - mm(6), { continued: true, width: CONTENT_WIDTH / 2 });
  doc.font('Helvetica').fillColor(COLOR_MUTED)
    .text(`   ·   ${config.title} Report`, { continued: false });
  doc.moveTo(PAGE_MARGIN, PAGE_MARGIN - mm(1)).lineTo(PAGE_MARGIN + CONTENT_WIDTH, PAGE_MARGIN - mm(1)).strokeColor(COLOR_BORDER).stroke();
  doc.y = PAGE_MARGIN + mm(3);
  doc.x = PAGE_MARGIN;
}

function drawFooters(doc) {
  const range = doc.bufferedPageRange();
  // Both lines must land ENTIRELY within doc.page.height - PAGE_MARGIN —
  // writing even 1pt past that boundary makes pdfkit think the content
  // doesn't fit and silently insert a brand new page to hold it (which,
  // with the pageAdded->drawCompactHeader listener registered below,
  // cascades into extra blank pages each carrying half a footer). Ending
  // the second line exactly AT the margin line, not past it, avoids that.
  const bottom = doc.page.height - PAGE_MARGIN - mm(9);
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.fontSize(8).font('Helvetica').fillColor(COLOR_MUTED)
      .text('Generated by JOZZY Sales Management System', PAGE_MARGIN, bottom, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
    doc.fontSize(8).font('Helvetica').fillColor(COLOR_MUTED)
      .text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN, bottom + mm(4.5), { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
  }
}

// Executive Summary as a grid of colored KPI cards (3 per row) instead of
// plain "Label: Value" text lines — a rounded card with a colored left
// accent bar, matching the on-screen KPICard's visual language.
function drawKpiCards(doc, entries) {
  const perRow = 3;
  const gap = mm(4);
  const cardWidth = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow;
  const cardHeight = mm(18);

  entries.forEach((entry, index) => {
    const col = index % perRow;
    if (col === 0) ensureSpace(doc, cardHeight + mm(4));
    const x = PAGE_MARGIN + col * (cardWidth + gap);
    const y = doc.y;
    const accent = KPI_ACCENTS[index % KPI_ACCENTS.length];

    doc.roundedRect(x, y, cardWidth, cardHeight, 4).fillAndStroke(COLOR_LIGHT_GRAY, COLOR_BORDER);
    doc.rect(x, y, mm(1.4), cardHeight).fill(accent);

    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_MUTED)
      .text(entry.label, x + mm(4), y + mm(3), { width: cardWidth - mm(6) });
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLOR_NAVY)
      .text(entry.formatted, x + mm(4), y + mm(9), { width: cardWidth - mm(6) });

    if (col === perRow - 1 || index === entries.length - 1) {
      doc.y = y + cardHeight + gap;
      doc.x = PAGE_MARGIN;
    }
  });
  doc.moveDown(0.4);
}

function drawBulletList(doc, lines, { bullet = '•', color = COLOR_NAVY } = {}) {
  doc.fontSize(9).font('Helvetica').fillColor(color);
  lines.forEach((line) => {
    ensureSpace(doc, mm(6));
    doc.text(`${bullet}  ${sanitizeForPdf(line)}`, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });
  });
}

// Financial Summary — a distinct, compact section (separate from the KPI
// card grid) for the metrics that only make sense on revenue-bearing
// reports (Total Revenue, Average Daily Sales, Average Invoice, Highest/
// Lowest Sales Day). Only rendered when report.financialSummary exists
// (sales/profit/all — see reportAnalysis.js's dayRowsFinancialSummary).
function drawFinancialSummary(doc, financialSummary) {
  sectionTitle(doc, 'Financial Summary');
  const rows = [
    ['Total Revenue', formatCell('totalRevenue', financialSummary.totalRevenue)],
    ['Average Daily Sales', formatCell('totalRevenue', financialSummary.averageDailySales)],
    ...(financialSummary.averageInvoice != null ? [['Average Invoice', formatCell('totalRevenue', financialSummary.averageInvoice)]] : []),
    ['Highest Sales Day', `${financialSummary.highestSalesDay.date} — ${formatCell('totalRevenue', financialSummary.highestSalesDay.value)}`],
    ['Lowest Sales Day', `${financialSummary.lowestSalesDay.date} — ${formatCell('totalRevenue', financialSummary.lowestSalesDay.value)}`],
  ];

  const rowHeight = mm(6.5);
  ensureSpace(doc, rowHeight * rows.length + mm(4));
  rows.forEach(([label, value], index) => {
    const y = doc.y;
    if (index % 2 === 1) doc.rect(PAGE_MARGIN, y - 1, CONTENT_WIDTH, rowHeight).fill(COLOR_ROW_ALT);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_NAVY).text(label, PAGE_MARGIN + 4, y, { width: CONTENT_WIDTH * 0.45, continued: false });
    doc.fontSize(9).font('Helvetica').fillColor(COLOR_NAVY).text(value, PAGE_MARGIN + CONTENT_WIDTH * 0.45, y, { width: CONTENT_WIDTH * 0.55 - 4 });
    doc.y = y + rowHeight;
  });
  divider(doc);
}

// A real, native vector bar chart — pdfkit has no chart API and this repo
// has no headless chart-rasterization library available (no puppeteer /
// chartjs-node-canvas), so this draws actual rectangles sized from the
// data rather than embedding an image. Capped at 20 bars — a longer date
// range still gets the full detailed table below, just not one bar per day
// once it would be too cramped to read.
function drawBarChart(doc, title, rows) {
  if (!rows || rows.length === 0) return;
  const data = rows.length > 20
    ? rows.filter((_, i) => i % Math.ceil(rows.length / 20) === 0)
    : rows;

  sectionTitle(doc, title);
  const chartHeight = mm(45);
  ensureSpace(doc, chartHeight + mm(14));

  // A reserved left gutter for the y-axis value labels — without it, the
  // bars start right under PAGE_MARGIN and the widest gridline label (the
  // 100% one, e.g. "TSh 1,040,000") draws directly on top of the first
  // 1-2 bars instead of beside them.
  const axisGutter = mm(20);
  const chartTop = doc.y;
  const chartLeft = PAGE_MARGIN + axisGutter;
  const chartWidth = CONTENT_WIDTH - axisGutter;
  const maxValue = Math.max(...data.map((r) => Number(r.value)), 1);
  const barGap = mm(1.5);
  const barWidth = (chartWidth - barGap * (data.length - 1)) / data.length;

  // Gridlines at 0/25/50/75/100% of max, with the value labelled on the left.
  [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
    const y = chartTop + chartHeight - frac * chartHeight;
    doc.moveTo(chartLeft, y).lineTo(chartLeft + chartWidth, y).strokeColor(COLOR_BORDER).stroke();
    doc.fontSize(6).font('Helvetica').fillColor(COLOR_MUTED)
      .text(formatCell('value', maxValue * frac), PAGE_MARGIN, y - mm(2.2), { width: axisGutter - mm(2), align: 'right' });
  });

  data.forEach((row, index) => {
    const barHeight = Math.max((Number(row.value) / maxValue) * chartHeight, 1);
    const x = chartLeft + index * (barWidth + barGap);
    const y = chartTop + chartHeight - barHeight;
    const color = index % 3 === 0 ? COLOR_NAVY : index % 3 === 1 ? COLOR_EMERALD : COLOR_GOLD;
    doc.rect(x, y, barWidth, barHeight).fill(color);

    if (data.length <= 14) {
      doc.fontSize(5.5).font('Helvetica').fillColor(COLOR_MUTED)
        .text(String(row.label).slice(5), x - mm(1), chartTop + chartHeight + mm(1.5), { width: barWidth + mm(2), align: 'center' });
    }
  });

  doc.y = chartTop + chartHeight + mm(8);
  doc.x = PAGE_MARGIN;
  divider(doc);
}

export function buildReportPdf(type, report, { dateFrom, dateTo, company, generatedByName, filtersLabel, branchLabel } = {}) {
  const config = resolveConfig(type, report);
  const dateRangeLabel = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All time';

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const headerContext = { config, dateRangeLabel, company, generatedByName, filtersLabel, branchLabel };
  drawFullHeader(doc, headerContext);
  doc.on('pageAdded', () => drawCompactHeader(doc, headerContext));

  if (report.summary && config.summaryLabels) {
    sectionTitle(doc, 'Executive Summary');
    const entries = Object.entries(config.summaryLabels).map(([key, label]) => ({
      label, formatted: formatCell(key, report.summary[key]),
    }));
    drawKpiCards(doc, entries);
    divider(doc);
  }

  if (report.financialSummary) {
    drawFinancialSummary(doc, report.financialSummary);
  }

  // The primary day-based breakdown becomes the chart — sales/all use
  // byDay/salesByDay (transaction count + revenue), profit's byDay is
  // profit-per-day. Whichever one exists on this report type is charted;
  // reports with no date breakdown (inventory, customers, ...) get no
  // chart section at all rather than a misleading empty one.
  const chartRows = report.byDay || report.salesByDay;
  if (Array.isArray(chartRows) && chartRows.length > 0) {
    drawBarChart(doc, type === 'profit' ? 'Daily Profit Trend' : 'Sales Trend', chartRows);
  }

  // Only appears when the date range spans 2+ calendar months (see
  // reportAnalysis.js's monthlyTrend()) — a single-month range would just
  // duplicate the daily chart above with one bar.
  if (Array.isArray(report.financialSummary?.monthlyTrend)) {
    const monthlyRows = report.financialSummary.monthlyTrend.map((m) => ({ label: m.month, value: m.value }));
    drawBarChart(doc, 'Monthly Trend', monthlyRows);
  }

  if (Array.isArray(report.analysis) && report.analysis.length > 0) {
    sectionTitle(doc, 'Business Analysis');
    drawBulletList(doc, report.analysis, { bullet: '•', color: COLOR_NAVY });
    divider(doc);
  }

  if (Array.isArray(report.recommendations) && report.recommendations.length > 0) {
    sectionTitle(doc, 'Recommendations');
    drawBulletList(doc, report.recommendations, { bullet: '»', color: COLOR_EMERALD });
    divider(doc);
  }

  config.breakdowns.forEach(({ key, title: breakdownTitle, labelHeader }) => {
    const rows = report[key];

    sectionTitle(doc, breakdownTitle);

    if (!rows || rows.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor(COLOR_MUTED).text('No data for the selected filters.', { width: CONTENT_WIDTH });
      doc.fillColor(COLOR_NAVY);
      divider(doc);
      return;
    }

    const columns = Object.keys(rows[0]).filter((c) => c !== 'id' && c !== 'code');
    const columnWidth = CONTENT_WIDTH / columns.length;
    const rowHeight = mm(6);

    ensureSpace(doc, rowHeight * 2);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLOR_WHITE);
    let rowY = doc.y;
    doc.roundedRect(PAGE_MARGIN, rowY - 2, CONTENT_WIDTH, rowHeight, 2).fill(COLOR_NAVY);
    doc.fillColor(COLOR_WHITE);
    columns.forEach((c, index) => {
      doc.text(c === 'label' ? labelHeader : humanize(c), PAGE_MARGIN + index * columnWidth + 2, rowY, { width: columnWidth - 4 });
    });
    doc.y = rowY + rowHeight;
    doc.font('Helvetica');

    // A money-bearing column (if any) gets summed into a Grand Total row
    // appended after the data — the first numeric column flagged as money
    // in reportConfig's MONEY_KEYS, matching what the UI's own summary
    // cards already treat as the report's headline currency figure.
    const totalColumn = columns.find((c) => typeof rows[0][c] === 'number' && MONEY_KEYS.has(c));
    let runningTotal = 0;

    rows.forEach((row, index) => {
      ensureSpace(doc, rowHeight);
      rowY = doc.y;
      if (index % 2 === 1) {
        doc.rect(PAGE_MARGIN, rowY - 1, CONTENT_WIDTH, rowHeight).fill(COLOR_ROW_ALT);
      }
      doc.fillColor(COLOR_NAVY);
      columns.forEach((c, colIndex) => {
        doc.fontSize(8).text(formatCell(c, row[c]), PAGE_MARGIN + colIndex * columnWidth + 2, rowY, { width: columnWidth - 4 });
      });
      if (totalColumn) runningTotal += Number(row[totalColumn]) || 0;
      doc.y = rowY + rowHeight;
    });

    if (totalColumn) {
      ensureSpace(doc, rowHeight);
      rowY = doc.y;
      doc.roundedRect(PAGE_MARGIN, rowY - 1, CONTENT_WIDTH, rowHeight, 2).fill(COLOR_EMERALD);
      doc.fillColor(COLOR_WHITE).font('Helvetica-Bold');
      const totalColIndex = columns.indexOf(totalColumn);
      doc.text('Grand Total', PAGE_MARGIN + 2, rowY, { width: columnWidth * totalColIndex - 4 });
      doc.text(formatCell(totalColumn, runningTotal), PAGE_MARGIN + totalColIndex * columnWidth + 2, rowY, { width: columnWidth - 4 });
      doc.y = rowY + rowHeight;
      doc.font('Helvetica').fillColor(COLOR_NAVY);
    }

    divider(doc);
  });

  drawFooters(doc);
  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      logger.info('Report PDF generated', { type });
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}
