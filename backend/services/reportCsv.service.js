import { resolveConfig, humanize, formatCell } from './reportConfig.js';

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
export function buildReportCsv(type, report, { dateFrom, dateTo, company, generatedByName } = {}) {
  const config = resolveConfig(type, report);
  const dateRangeLabel = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All time';
  const sections = [
    csvEscape(company?.company_name || 'JOZZY Sales Management System'),
    csvEscape(`${config.title} Report`),
    `Date Range,${csvEscape(dateRangeLabel)}`,
    `Generated,${csvEscape(new Date().toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' }))}`,
    ...(generatedByName ? [`Prepared By,${csvEscape(generatedByName)}`] : []),
    '',
  ];

  if (report.summary && config.summaryLabels) {
    sections.push('Executive Summary');
    sections.push('Metric,Value');
    Object.entries(config.summaryLabels).forEach(([key, label]) => {
      sections.push(`${csvEscape(label)},${csvEscape(formatCell(key, report.summary[key]))}`);
    });
    sections.push('');
  }

  if (report.financialSummary) {
    const fs = report.financialSummary;
    sections.push('Financial Summary');
    sections.push('Metric,Value');
    sections.push(`Total Revenue,${csvEscape(formatCell('totalRevenue', fs.totalRevenue))}`);
    sections.push(`Average Daily Sales,${csvEscape(formatCell('totalRevenue', fs.averageDailySales))}`);
    if (fs.averageInvoice != null) {
      sections.push(`Average Invoice,${csvEscape(formatCell('totalRevenue', fs.averageInvoice))}`);
    }
    sections.push(`Highest Sales Day,${csvEscape(`${fs.highestSalesDay.date} (${formatCell('totalRevenue', fs.highestSalesDay.value)})`)}`);
    sections.push(`Lowest Sales Day,${csvEscape(`${fs.lowestSalesDay.date} (${formatCell('totalRevenue', fs.lowestSalesDay.value)})`)}`);
    sections.push('');

    if (Array.isArray(fs.monthlyTrend)) {
      sections.push('Monthly Trend');
      sections.push('Month,Revenue');
      fs.monthlyTrend.forEach(({ month, value }) => sections.push(`${csvEscape(month)},${csvEscape(formatCell('totalRevenue', value))}`));
      sections.push('');
    }
  }

  if (Array.isArray(report.analysis) && report.analysis.length > 0) {
    sections.push('Business Analysis');
    report.analysis.forEach((line) => sections.push(csvEscape(line)));
    sections.push('');
  }

  if (Array.isArray(report.recommendations) && report.recommendations.length > 0) {
    sections.push('Recommendations');
    report.recommendations.forEach((line) => sections.push(csvEscape(line)));
    sections.push('');
  }

  config.breakdowns.forEach(({ key, title: breakdownTitle, labelHeader }) => {
    const rows = report[key];
    sections.push(breakdownTitle);
    if (!rows || rows.length === 0) {
      sections.push('No data for the selected filters.');
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
