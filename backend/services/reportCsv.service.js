import { resolveConfig, humanize, formatCell } from './reportConfig.js';
import { t } from '../i18n/index.js';

// UTF-8 BOM so Excel (which otherwise guesses the wrong encoding for
// non-ASCII characters) opens the exported file cleanly.
const BOM = String.fromCharCode(0xfeff);

// Ported from src/utils/exportCsv.js's csvEscape — same escaping rules,
// reimplemented here since that file is frontend-only.
function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(rows, columns, headerLabels) {
  return [
    headerLabels.join(','),
    ...rows.map((row) => columns.map((col) => csvEscape(row[col])).join(',')),
  ].join('\n');
}

// Whole-report export (summary + every breakdown, each as its own labeled
// section) — distinct from the frontend's existing per-breakdown-table CSV
// button, which stays as a quick one-table-at-a-time option.
export function buildReportCsv(type, report, { dateFrom, dateTo, company, generatedByName, locale = 'en' } = {}) {
  const config = resolveConfig(type, report, locale);
  const dateRangeLabel = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : t(locale, 'common.allTime');
  const dateLocale = locale === 'sw' ? 'sw-TZ' : 'en-TZ';
  const sections = [
    csvEscape(company?.company_name || 'Clix Sales System'),
    csvEscape(`${config.title} ${t(locale, 'common.report')}`),
    `${t(locale, 'common.dateRange')},${csvEscape(dateRangeLabel)}`,
    `${t(locale, 'common.generated')},${csvEscape(new Date().toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }))}`,
    ...(generatedByName ? [`${t(locale, 'common.preparedBy')},${csvEscape(generatedByName)}`] : []),
    '',
  ];

  if (report.summary && config.summaryLabels) {
    sections.push(t(locale, 'common.executiveSummary'));
    sections.push(`${t(locale, 'common.metric')},${t(locale, 'common.value')}`);
    Object.entries(config.summaryLabels).forEach(([key, label]) => {
      sections.push(`${csvEscape(label)},${csvEscape(formatCell(key, report.summary[key]))}`);
    });
    sections.push('');
  }

  if (report.financialSummary) {
    const fs = report.financialSummary;
    sections.push(t(locale, 'common.financialSummary'));
    sections.push(`${t(locale, 'common.metric')},${t(locale, 'common.value')}`);
    sections.push(`${t(locale, 'financialSummary.totalRevenue')},${csvEscape(formatCell('totalRevenue', fs.totalRevenue))}`);
    sections.push(`${t(locale, 'financialSummary.averageDailySales')},${csvEscape(formatCell('totalRevenue', fs.averageDailySales))}`);
    if (fs.averageInvoice != null) {
      sections.push(`${t(locale, 'financialSummary.averageInvoice')},${csvEscape(formatCell('totalRevenue', fs.averageInvoice))}`);
    }
    sections.push(`${t(locale, 'financialSummary.highestSalesDay')},${csvEscape(`${fs.highestSalesDay.date} (${formatCell('totalRevenue', fs.highestSalesDay.value)})`)}`);
    sections.push(`${t(locale, 'financialSummary.lowestSalesDay')},${csvEscape(`${fs.lowestSalesDay.date} (${formatCell('totalRevenue', fs.lowestSalesDay.value)})`)}`);
    sections.push('');

    if (Array.isArray(fs.monthlyTrend)) {
      sections.push(t(locale, 'common.monthlyTrend'));
      sections.push(`${t(locale, 'common.month')},${t(locale, 'common.revenue')}`);
      fs.monthlyTrend.forEach(({ month, value }) => sections.push(`${csvEscape(month)},${csvEscape(formatCell('totalRevenue', value))}`));
      sections.push('');
    }
  }

  // report.analysis/report.recommendations are dynamically-generated English
  // business-insight sentences (reportAnalysis.js) — not static UI chrome —
  // so they render as authored (English) regardless of locale; only the
  // section headings around them are translated.
  if (Array.isArray(report.analysis) && report.analysis.length > 0) {
    sections.push(t(locale, 'common.businessAnalysis'));
    report.analysis.forEach((line) => sections.push(csvEscape(line)));
    sections.push('');
  }

  if (Array.isArray(report.recommendations) && report.recommendations.length > 0) {
    sections.push(t(locale, 'common.recommendations'));
    report.recommendations.forEach((line) => sections.push(csvEscape(line)));
    sections.push('');
  }

  config.breakdowns.forEach(({ key, title: breakdownTitle, labelHeader }) => {
    const rows = report[key];
    sections.push(breakdownTitle);
    if (!rows || rows.length === 0) {
      sections.push(t(locale, 'common.noDataForFilters'));
      sections.push('');
      return;
    }
    const columns = Object.keys(rows[0]).filter((c) => c !== 'id' && c !== 'code');
    const headerLabels = columns.map((c) => (c === 'label' ? labelHeader : humanize(c)));
    sections.push(rowsToCsv(rows, columns, headerLabels));
    sections.push('');
  });

  return BOM + sections.join('\n');
}
