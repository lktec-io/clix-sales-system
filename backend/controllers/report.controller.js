import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as reportService from '../services/report.service.js';
import { buildReportPdf } from '../services/reportPdf.service.js';
import { buildReportExcel } from '../services/reportExcel.service.js';
import { buildReportCsv } from '../services/reportCsv.service.js';
import { buildReportFilename } from '../services/reportConfig.js';
import { t, resolveLocale } from '../i18n/index.js';
import * as companyRepository from '../repositories/company.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as categoryRepository from '../repositories/category.repository.js';
import * as customerRepository from '../repositories/customer.repository.js';
import * as productRepository from '../repositories/product.repository.js';

export const getReport = asyncHandler(async (req, res) => {
  const report = await reportService.getReport(req.params.type, req.query, req.user);
  return success(res, { data: report });
});

// Resolves the human-readable names behind whatever filter query params are
// present (raw IDs would be meaningless on a printed report) — only looks up
// the ones the Reports UI actually exposes as filter inputs. Branch is
// resolved separately (see buildExportContext) since the report header
// prints it as its own labelled line, not folded into this generic string.
async function buildFiltersLabel(query, locale) {
  const parts = [];
  if (query.categoryId) {
    const category = await categoryRepository.findById(Number(query.categoryId));
    if (category) parts.push(`${t(locale, 'breakdownHeaders.category')}: ${category.name}`);
  }
  if (query.customerId) {
    const customer = await customerRepository.findById(Number(query.customerId));
    if (customer) parts.push(`${t(locale, 'breakdownHeaders.customer')}: ${customer.first_name} ${customer.last_name}`);
  }
  if (query.productId) {
    const product = await productRepository.findById(Number(query.productId));
    if (product) parts.push(`${t(locale, 'breakdownHeaders.product')}: ${product.name}`);
  }
  if (query.cashierId) {
    const cashier = await userRepository.findById(Number(query.cashierId));
    if (cashier) parts.push(`${t(locale, 'filterLabels.cashier')}: ${cashier.first_name} ${cashier.last_name}`);
  }
  if (query.status) {
    // The status VALUE itself (e.g. "pending") is business data, not
    // translated — only the "Status:" label prefix is.
    parts.push(`${t(locale, 'filterLabels.status')}: ${query.status.charAt(0).toUpperCase()}${query.status.slice(1)}`);
  }
  return parts.join(' · ');
}

async function buildExportContext(req, locale) {
  const [company, generatedBy, filtersLabel, branch] = await Promise.all([
    companyRepository.get(),
    userRepository.findById(req.user.id),
    buildFiltersLabel(req.query, locale),
    req.query.branchId ? branchRepository.findById(Number(req.query.branchId)) : null,
  ]);
  return {
    company,
    generatedByName: generatedBy ? `${generatedBy.first_name} ${generatedBy.last_name}` : undefined,
    filtersLabel,
    branchLabel: branch?.name,
    locale,
  };
}

export const exportPdf = asyncHandler(async (req, res) => {
  const locale = resolveLocale(req.query.locale);
  const report = await reportService.getReport(req.params.type, req.query, req.user);
  const context = await buildExportContext(req, locale);
  const pdf = await buildReportPdf(req.params.type, report, { ...req.query, ...context });
  const filename = buildReportFilename(req.params.type, report, 'pdf', locale);
  res.setHeader('Content-Type', 'application/pdf');
  // Was "inline" — the browser opened the PDF in a new tab instead of
  // downloading it. "attachment" is what actually triggers a direct
  // download, matching how Excel/CSV already behaved.
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdf);
});

export const exportExcel = asyncHandler(async (req, res) => {
  const locale = resolveLocale(req.query.locale);
  const report = await reportService.getReport(req.params.type, req.query, req.user);
  const context = await buildExportContext(req, locale);
  const workbook = await buildReportExcel(req.params.type, report, { ...req.query, ...context });
  const filename = buildReportFilename(req.params.type, report, 'xlsx', locale);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

export const exportCsv = asyncHandler(async (req, res) => {
  const locale = resolveLocale(req.query.locale);
  const report = await reportService.getReport(req.params.type, req.query, req.user);
  const context = await buildExportContext(req, locale);
  const csv = buildReportCsv(req.params.type, report, { ...req.query, ...context });
  const filename = buildReportFilename(req.params.type, report, 'csv', locale);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});
