import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../config/logger.js';
import { resolveConfig, humanize, MONEY_KEYS } from './reportConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

// Clix brand palette — same Navy/Emerald/Gold tokens as reportPdf.service.js
// (ARGB, exceljs's color format — 'FF' alpha prefix + the same hex used
// everywhere else in the app's design system).
const COLOR_NAVY = 'FF0B1F4D';
const COLOR_EMERALD = 'FF10B981';
const COLOR_MUTED = 'FF64748B';
const COLOR_ROW_ALT = 'FFF8FAFC';
const COLOR_WHITE = 'FFFFFFFF';
const COLOR_LIGHT_GRAY = 'FFF1F5F9';

// Same local-path-only restriction as reportPdf.service.js — a Cloudinary
// (remote URL) logo is skipped rather than fetched over HTTP for embedding.
function resolveLocalLogoPath(logoPath) {
  if (!logoPath || !logoPath.startsWith('/uploads/')) return null;
  const absPath = path.join(UPLOADS_ROOT, logoPath.replace('/uploads/', ''));
  return fs.existsSync(absPath) ? absPath : null;
}

function isDateLabelColumn(key) {
  return key === 'label';
}

// exceljs has no native chart-writing API — a real Chart.js/Excel native
// chart embed here would need a different library this repo doesn't have
// installed. Deliberately not attempted with a fake substitute; the
// on-screen preview and the PDF export (drawBarChart, native pdfkit
// vectors) are where this report's chart actually lives.
function addSummarySheet(workbook, { config, dateRangeLabel, company, generatedByName, filtersLabel, branchLabel, report }) {
  const sheet = workbook.addWorksheet('Summary');
  sheet.properties.defaultColWidth = 16;
  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 30;

  let row = 1;
  const logoPath = resolveLocalLogoPath(company?.logo_path);
  if (logoPath) {
    try {
      const ext = path.extname(logoPath).replace('.', '').toLowerCase();
      const imageId = workbook.addImage({ filename: logoPath, extension: ext === 'jpg' ? 'jpeg' : ext });
      sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 90, height: 60 } });
      row = 4;
    } catch (err) {
      logger.warn('Report Excel: failed to embed company logo, skipping', { error: err.message });
    }
  }

  sheet.getCell(`A${row}`).value = company?.company_name || 'CLIX SALES SYSTEM';
  sheet.getCell(`A${row}`).font = { bold: true, size: 10, color: { argb: COLOR_MUTED } };
  row += 1;

  sheet.mergeCells(`A${row}:D${row}`);
  const titleCell = sheet.getCell(`A${row}`);
  titleCell.value = `${config.title} Report`;
  titleCell.font = { bold: true, size: 18, color: { argb: COLOR_NAVY } };
  row += 1;

  sheet.getCell(`A${row}`).value = dateRangeLabel;
  sheet.getCell(`A${row}`).font = { italic: true, color: { argb: COLOR_MUTED } };
  row += 1;

  sheet.getCell(`A${row}`).value = `Generated: ${new Date().toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' })}`;
  sheet.getCell(`A${row}`).font = { size: 9, color: { argb: COLOR_MUTED } };
  row += 1;
  if (generatedByName) {
    sheet.getCell(`A${row}`).value = `Prepared By: ${generatedByName}`;
    sheet.getCell(`A${row}`).font = { size: 9, color: { argb: COLOR_MUTED } };
    row += 1;
  }
  if (branchLabel) {
    sheet.getCell(`A${row}`).value = `Branch: ${branchLabel}`;
    sheet.getCell(`A${row}`).font = { size: 9, color: { argb: COLOR_MUTED } };
    row += 1;
  }
  if (filtersLabel) {
    sheet.getCell(`A${row}`).value = `Filters: ${filtersLabel}`;
    sheet.getCell(`A${row}`).font = { size: 9, color: { argb: COLOR_MUTED } };
    row += 1;
  }
  row += 1;

  if (report.summary && config.summaryLabels) {
    sheet.getCell(`A${row}`).value = 'Executive Summary';
    sheet.getCell(`A${row}`).font = { bold: true, size: 13, color: { argb: COLOR_NAVY } };
    row += 1;
    Object.entries(config.summaryLabels).forEach(([key, label]) => {
      const value = report.summary[key];
      const labelCell = sheet.getCell(`A${row}`);
      labelCell.value = label;
      labelCell.font = { bold: true, color: { argb: COLOR_NAVY } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_LIGHT_GRAY } };
      const valueCell = sheet.getCell(`B${row}`);
      valueCell.value = value;
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_LIGHT_GRAY } };
      if (MONEY_KEYS.has(key)) valueCell.numFmt = '"TZS" #,##0.00';
      row += 1;
    });
    row += 1;
  }

  if (report.financialSummary) {
    const fs2 = report.financialSummary;
    sheet.getCell(`A${row}`).value = 'Financial Summary';
    sheet.getCell(`A${row}`).font = { bold: true, size: 13, color: { argb: COLOR_NAVY } };
    row += 1;
    const financialRows = [
      ['Total Revenue', fs2.totalRevenue, true],
      ['Average Daily Sales', fs2.averageDailySales, true],
      ...(fs2.averageInvoice != null ? [['Average Invoice', fs2.averageInvoice, true]] : []),
      ['Highest Sales Day', `${fs2.highestSalesDay.date} (${fs2.highestSalesDay.value.toLocaleString()})`, false],
      ['Lowest Sales Day', `${fs2.lowestSalesDay.date} (${fs2.lowestSalesDay.value.toLocaleString()})`, false],
    ];
    financialRows.forEach(([label, value, isMoney]) => {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`A${row}`).font = { bold: true };
      const valueCell = sheet.getCell(`B${row}`);
      valueCell.value = value;
      if (isMoney) valueCell.numFmt = '"TZS" #,##0.00';
      row += 1;
    });
    row += 1;

    if (Array.isArray(fs2.monthlyTrend)) {
      sheet.getCell(`A${row}`).value = 'Monthly Trend';
      sheet.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: COLOR_NAVY } };
      row += 1;
      fs2.monthlyTrend.forEach(({ month, value }) => {
        sheet.getCell(`A${row}`).value = month;
        const valueCell = sheet.getCell(`B${row}`);
        valueCell.value = value;
        valueCell.numFmt = '"TZS" #,##0.00';
        row += 1;
      });
      row += 1;
    }
  }

  if (Array.isArray(report.analysis) && report.analysis.length > 0) {
    sheet.getCell(`A${row}`).value = 'Business Analysis';
    sheet.getCell(`A${row}`).font = { bold: true, size: 13, color: { argb: COLOR_NAVY } };
    row += 1;
    report.analysis.forEach((line) => {
      sheet.mergeCells(`A${row}:D${row}`);
      sheet.getCell(`A${row}`).value = `•  ${line}`;
      row += 1;
    });
    row += 1;
  }

  if (Array.isArray(report.recommendations) && report.recommendations.length > 0) {
    sheet.getCell(`A${row}`).value = 'Recommendations';
    sheet.getCell(`A${row}`).font = { bold: true, size: 13, color: { argb: COLOR_NAVY } };
    row += 1;
    report.recommendations.forEach((line) => {
      sheet.mergeCells(`A${row}:D${row}`);
      const cell = sheet.getCell(`A${row}`);
      cell.value = `→  ${line}`;
      cell.font = { color: { argb: COLOR_EMERALD } };
      row += 1;
    });
  }
}

// exceljs worksheet names must be <=31 chars and unique within the
// workbook — breakdown titles are always distinct within one report type
// and short enough in practice, but this guards the length regardless.
function safeSheetName(title, usedNames) {
  let name = title.slice(0, 31);
  let suffix = 2;
  while (usedNames.has(name)) {
    name = `${title.slice(0, 28)} ${suffix}`;
    suffix += 1;
  }
  usedNames.add(name);
  return name;
}

function addBreakdownSheet(workbook, { title, labelHeader }, rows, usedNames) {
  const sheet = workbook.addWorksheet(safeSheetName(title, usedNames));

  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: COLOR_NAVY } };
  sheet.mergeCells('A1:D1');

  if (!rows || rows.length === 0) {
    sheet.getCell('A3').value = 'No data for the selected filters.';
    sheet.getCell('A3').font = { italic: true, color: { argb: COLOR_MUTED } };
    return;
  }

  const columns = Object.keys(rows[0]).filter((c) => c !== 'id' && c !== 'code');
  const headerRowIndex = 3;

  columns.forEach((c, colIndex) => {
    const cell = sheet.getCell(headerRowIndex, colIndex + 1);
    cell.value = c === 'label' ? labelHeader : humanize(c);
    cell.font = { bold: true, color: { argb: COLOR_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
  });

  let currentRow = headerRowIndex + 1;
  const totalColumn = columns.find((c) => typeof rows[0][c] === 'number' && MONEY_KEYS.has(c));
  let runningTotal = 0;

  rows.forEach((row, rowIndex) => {
    columns.forEach((c, colIndex) => {
      const cell = sheet.getCell(currentRow, colIndex + 1);
      cell.value = row[c];
      if (MONEY_KEYS.has(c) && typeof row[c] === 'number') cell.numFmt = '"TZS" #,##0.00';
      if (isDateLabelColumn(c) && /^\d{4}-\d{2}-\d{2}/.test(String(row[c]))) cell.numFmt = 'yyyy-mm-dd';
      if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROW_ALT } };
    });
    if (totalColumn) runningTotal += Number(row[totalColumn]) || 0;
    currentRow += 1;
  });

  if (totalColumn) {
    const totalColIndex = columns.indexOf(totalColumn);
    for (let col = 1; col <= columns.length; col += 1) {
      const cell = sheet.getCell(currentRow, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_EMERALD } };
      cell.font = { bold: true, color: { argb: COLOR_WHITE } };
    }
    sheet.getCell(currentRow, 1).value = 'Grand Total';
    const totalCell = sheet.getCell(currentRow, totalColIndex + 1);
    totalCell.value = runningTotal;
    totalCell.numFmt = '"TZS" #,##0.00';
  }

  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];

  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length;
      if (length > maxLength) maxLength = length;
    });
    column.width = Math.min(maxLength + 2, 40);
  });
}

export async function buildReportExcel(type, report, { dateFrom, dateTo, company, generatedByName, filtersLabel, branchLabel } = {}) {
  const config = resolveConfig(type, report);
  const dateRangeLabel = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All time';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Clix Sales System';
  workbook.created = new Date();

  addSummarySheet(workbook, { config, dateRangeLabel, company, generatedByName, filtersLabel, branchLabel, report });

  const usedNames = new Set(['Summary']);
  config.breakdowns.forEach((breakdown) => {
    addBreakdownSheet(workbook, breakdown, report[breakdown.key], usedNames);
  });

  return workbook;
}
