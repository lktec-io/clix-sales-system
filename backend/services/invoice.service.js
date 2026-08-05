import PDFDocument from 'pdfkit';
import { ApiError } from '../utils/apiError.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import * as invoiceRepository from '../repositories/invoice.repository.js';
import * as tenantRepository from '../repositories/tenant.repository.js';
import * as companyService from './company.service.js';
import * as platformSettingsService from './platformSettings.service.js';

const MM_TO_PT = 2.83465;
const mm = (value) => value * MM_TO_PT;
const PAGE_MARGIN = mm(15);
const PAGE_WIDTH = mm(210);
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// Same Navy/Emerald/Gold brand palette as reportPdf.service.js — an
// invoice is a boardroom document handed to a tenant's accountant, not a
// till receipt, so it uses the fuller palette rather than receipt.service
// .js's narrower Navy/Green-only one.
const COLOR_NAVY = '#0B1F4D';
const COLOR_EMERALD = '#10B981';
const COLOR_GOLD = '#C8A56A';
const COLOR_MUTED = '#64748B';
const COLOR_BORDER = '#E2E8F0';
const COLOR_LIGHT_GRAY = '#F1F5F9';
const COLOR_WHITE = '#FFFFFF';

const PAYMENT_STATUS_COLOR = {
  paid: COLOR_EMERALD,
  pending: COLOR_GOLD,
  failed: '#DC2626',
  void: COLOR_MUTED,
  refunded: COLOR_MUTED,
};

function formatCompanyAddress(company) {
  return [company?.street, company?.district, company?.region].filter(Boolean).join(', ') || company?.address || '';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-TZ', { dateStyle: 'medium' }) : '—';
}

// The invoice issuer is Clix Digital Works (the platform operator), not the
// tenant — a subscription invoice is billed BY the platform TO the tenant.
// `branding` is platformSettingsService.getSettings()'s
// companyBrandingName/supportEmail/supportPhone, not the tenant's own
// company_settings (that appears in drawBillTo() instead).
function drawHeader(doc, branding) {
  doc.fillColor(COLOR_NAVY).font('Helvetica-Bold').fontSize(16).text(branding?.companyBrandingName || 'Clix Digital Works', PAGE_MARGIN, PAGE_MARGIN, { width: CONTENT_WIDTH });
  doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(9);
  const contactLine = [branding?.supportEmail, branding?.supportPhone].filter(Boolean).join(' · ');
  if (contactLine) doc.text(contactLine, PAGE_MARGIN, doc.y + 2, { width: CONTENT_WIDTH });

  doc.moveTo(PAGE_MARGIN, PAGE_MARGIN + mm(24)).lineTo(PAGE_MARGIN + CONTENT_WIDTH, PAGE_MARGIN + mm(24))
    .lineWidth(1.5).strokeColor(COLOR_GOLD).stroke();

  doc.y = PAGE_MARGIN + mm(32);
}

function drawTitleAndMeta(doc, invoice) {
  doc.fillColor(COLOR_NAVY).font('Helvetica-Bold').fontSize(22).text('INVOICE', PAGE_MARGIN, doc.y);

  const metaTop = doc.y + mm(2);
  const metaX = PAGE_MARGIN + CONTENT_WIDTH / 2;
  const metaWidth = CONTENT_WIDTH / 2;

  const rows = [
    ['Invoice Number', invoice.invoice_number],
    ['Reference Number', invoice.reference_number || '—'],
    ['Issue Date', formatDate(invoice.issue_date)],
    ['Due Date', formatDate(invoice.due_date)],
  ];

  doc.font('Helvetica').fontSize(9).fillColor(COLOR_MUTED);
  let y = metaTop;
  for (const [label, value] of rows) {
    doc.text(label, metaX, y, { width: metaWidth * 0.5, continued: false });
    doc.font('Helvetica-Bold').fillColor(COLOR_NAVY).text(value, metaX + metaWidth * 0.5, y, { width: metaWidth * 0.5 });
    doc.font('Helvetica').fillColor(COLOR_MUTED);
    y += mm(6);
  }

  doc.y = Math.max(doc.y, y) + mm(6);
}

function drawBillTo(doc, tenant, tenantCompany) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_MUTED).text('BILL TO', PAGE_MARGIN, doc.y);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLOR_NAVY).text(tenant?.company_name || `Tenant #${tenant?.id ?? ''}`, PAGE_MARGIN, doc.y + 2);
  doc.font('Helvetica').fontSize(9).fillColor(COLOR_MUTED);
  const addressLine = formatCompanyAddress(tenantCompany);
  if (addressLine) doc.text(addressLine, PAGE_MARGIN, doc.y + 1);
  if (tenantCompany?.email) doc.text(tenantCompany.email, PAGE_MARGIN, doc.y + 1);

  doc.y += mm(8);
}

function drawLineItemsTable(doc, invoice) {
  const columns = [
    { label: 'Description', width: CONTENT_WIDTH * 0.45 },
    { label: 'Billing Period', width: CONTENT_WIDTH * 0.3 },
    { label: 'Amount', width: CONTENT_WIDTH * 0.25 },
  ];

  const tableTop = doc.y;
  doc.rect(PAGE_MARGIN, tableTop, CONTENT_WIDTH, mm(8)).fill(COLOR_NAVY);
  doc.fillColor(COLOR_WHITE).font('Helvetica-Bold').fontSize(9);
  let x = PAGE_MARGIN + mm(3);
  for (const col of columns) {
    doc.text(col.label, x, tableTop + mm(2.3), { width: col.width });
    x += col.width;
  }

  const rowTop = tableTop + mm(8);
  const rowHeight = mm(10);
  doc.rect(PAGE_MARGIN, rowTop, CONTENT_WIDTH, rowHeight).fillAndStroke(COLOR_LIGHT_GRAY, COLOR_BORDER);
  doc.fillColor(COLOR_NAVY).font('Helvetica').fontSize(9.5);
  x = PAGE_MARGIN + mm(3);
  doc.text(`${invoice.plan_name_snapshot} Plan — ${invoice.billing_cycle}`, x, rowTop + mm(3), { width: columns[0].width });
  x += columns[0].width;
  doc.text(`${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`, x, rowTop + mm(3), { width: columns[1].width });
  x += columns[1].width;
  doc.font('Helvetica-Bold').text(formatCurrency(invoice.subtotal, invoice.currency), x, rowTop + mm(3), { width: columns[2].width });

  doc.y = rowTop + rowHeight + mm(4);
}

function drawTotals(doc, invoice) {
  const labelWidth = mm(35);
  const valueWidth = mm(35);
  const totalsX = PAGE_MARGIN + CONTENT_WIDTH - labelWidth - valueWidth;

  const rows = [
    ['Subtotal', formatCurrency(invoice.subtotal, invoice.currency)],
    ['Tax', formatCurrency(invoice.tax_amount, invoice.currency)],
    ['Discount', `-${formatCurrency(invoice.discount_amount, invoice.currency)}`],
  ];

  doc.font('Helvetica').fontSize(9.5).fillColor(COLOR_MUTED);
  for (const [label, value] of rows) {
    doc.text(label, totalsX, doc.y, { width: labelWidth });
    doc.text(value, totalsX + labelWidth, doc.y - doc.currentLineHeight(), { width: valueWidth, align: 'right' });
    doc.moveDown(0.6);
  }

  doc.moveTo(totalsX, doc.y).lineTo(totalsX + labelWidth + valueWidth, doc.y).strokeColor(COLOR_BORDER).stroke();
  doc.moveDown(0.4);

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLOR_NAVY);
  doc.text('Total', totalsX, doc.y, { width: labelWidth });
  doc.text(formatCurrency(invoice.total, invoice.currency), totalsX + labelWidth, doc.y - doc.currentLineHeight(), { width: valueWidth, align: 'right' });

  doc.y += mm(10);
}

function drawPaymentStatus(doc, invoice) {
  const color = PAYMENT_STATUS_COLOR[invoice.payment_status] || COLOR_MUTED;
  const label = invoice.payment_status.toUpperCase();
  const badgeWidth = mm(28);
  const badgeHeight = mm(8);

  doc.roundedRect(PAGE_MARGIN, doc.y, badgeWidth, badgeHeight, 3).fill(color);
  doc.fillColor(COLOR_WHITE).font('Helvetica-Bold').fontSize(9).text(label, PAGE_MARGIN, doc.y - badgeHeight + mm(2.4), { width: badgeWidth, align: 'center' });
  doc.y += mm(4);
}

function drawFooter(doc) {
  doc.font('Helvetica').fontSize(8).fillColor(COLOR_MUTED).text(
    'Thank you for your business.',
    PAGE_MARGIN, doc.page.height - PAGE_MARGIN - mm(10), { width: CONTENT_WIDTH, align: 'center' },
  );
}

// branding = platformSettingsService.getSettings() (the issuer, Clix
// Digital Works); tenantCompany = companyService.getProfile(tenantId) (the
// bill-to party) — two different "company" concepts, never conflated.
export async function buildInvoicePdf(invoice, tenant, tenantCompany, branding) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, branding);
    drawTitleAndMeta(doc, invoice);
    drawBillTo(doc, tenant, tenantCompany);
    drawLineItemsTable(doc, invoice);
    drawTotals(doc, invoice);
    drawPaymentStatus(doc, invoice);
    drawFooter(doc);

    doc.end();
  });
}

export async function listMine(tenantId, query) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await invoiceRepository.findByTenant(tenantId, { page, limit, paymentStatus: query.paymentStatus });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getMine(id, tenantId) {
  const invoice = await invoiceRepository.findByIdForTenant(id, tenantId);
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return invoice;
}

export async function listForPlatform(query) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const { rows, total } = await invoiceRepository.findAllForPlatform({
    page, limit, tenantId: query.tenantId ? Number(query.tenantId) : undefined, paymentStatus: query.paymentStatus,
  });
  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getForPlatform(id) {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return invoice;
}

// Shared by both the tenant's "download my invoice" and the platform
// admin's "download tenant X's invoice" endpoints — same document either
// way, just a different access-control check upstream (see
// invoice.controller.js).
export async function downloadPdf(invoice) {
  const [tenant, tenantCompany, branding] = await Promise.all([
    tenantRepository.findById(invoice.tenant_id),
    companyService.getProfile(invoice.tenant_id),
    platformSettingsService.getSettings(),
  ]);
  return buildInvoicePdf(invoice, tenant, tenantCompany, branding);
}
