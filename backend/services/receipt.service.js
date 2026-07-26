import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { formatCurrency } from '../utils/formatCurrency.js';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const MM_TO_PT = 2.83465;
const mm = (value) => value * MM_TO_PT;

// Receipt-only palette — deliberately narrower than the report exporters'
// Navy/Emerald/Gold (reportPdf.service.js): a receipt is handed to a
// customer at the till, not a boardroom document, so it stays to Navy,
// Green, White, and Light Gray with no gold accent.
const COLOR_NAVY = '#0B1F4D';
const COLOR_GREEN = '#10B981';
const COLOR_WHITE = '#FFFFFF';
const COLOR_GRAY = '#64748B';
const COLOR_LIGHT_GRAY = '#F1F5F9';
const COLOR_BORDER = '#E2E8F0';

const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  airtel_money: 'Airtel Money',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
};

// Three real paper shapes, not one narrow layout stretched or squeezed —
// 58mm/80mm are true thermal roll widths, A4 is a full page for a
// customer who wants a normal printed invoice-style receipt instead of a
// till slip. Column proportions (in receiptLayout below) are shared across
// all three; only widths/margins/font scale change per size.
const PAGE_SIZES = {
  58: { width: mm(58), margin: mm(3), fontScale: 0.85 },
  80: { width: mm(80), margin: mm(4), fontScale: 1 },
  a4: { width: mm(210), margin: mm(15), fontScale: 1.15 },
};

function resolvePageSize(sizeKey) {
  return PAGE_SIZES[sizeKey] || PAGE_SIZES[80];
}

// Only handles a locally-stored logo (logo_path starting with "/uploads/"),
// same restriction and reasoning as reportPdf.service.js's
// resolveLocalLogoPath — a Cloudinary-hosted logo is a remote URL that
// would need an async fetch to embed, not worth the extra request/failure
// surface on every single receipt print; those deployments get a
// text-only header, same as no logo configured at all.
function resolveLocalLogoPath(logoPath) {
  if (!logoPath || !logoPath.startsWith('/uploads/')) return null;
  const absPath = path.join(UPLOADS_ROOT, logoPath.replace('/uploads/', ''));
  return fs.existsSync(absPath) ? absPath : null;
}

function formatCompanyAddress(company) {
  return [company?.street, company?.district, company?.region].filter(Boolean).join(', ') || company?.address || '';
}

// A compact, self-contained verification payload — no lookup URL/endpoint
// exists in this app to point a QR at, so it encodes exactly what a
// cashier could otherwise read off the paper (receipt number, total, date)
// in a form that's fast to scan and cross-check, rather than a fabricated
// link to a page that doesn't exist. Same 'M' error-correction + 4-module
// quiet zone convention as qrCode.service.js's product QR codes.
async function buildVerificationQrBuffer(sale) {
  const payload = `RCPT:${sale.sale_number}:${formatCurrency(sale.total_amount)}:${sale.created_at}`;
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: 200,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

// A real bordered thermal-receipt table (Product / Qty / Unit Price /
// Discount / Total), not the previous "name line + qty x price sub-line"
// layout — the Discount column only renders when at least one line
// actually has a discount, so an ordinary undiscounted sale doesn't waste
// a column of dashes across every row.
function drawItemsTable(doc, items, { margin, contentWidth, fontScale }) {
  const hasDiscount = items.some((item) => Number(item.discount_amount) > 0);
  const columns = hasDiscount
    ? [
      { key: 'name', label: 'Product', width: 0.40 },
      { key: 'qty', label: 'Qty', width: 0.10 },
      { key: 'price', label: 'Price', width: 0.18 },
      { key: 'discount', label: 'Disc.', width: 0.14 },
      { key: 'total', label: 'Total', width: 0.18 },
    ]
    : [
      { key: 'name', label: 'Product', width: 0.46 },
      { key: 'qty', label: 'Qty', width: 0.12 },
      { key: 'price', label: 'Price', width: 0.20 },
      { key: 'total', label: 'Total', width: 0.22 },
    ];

  const headerHeight = mm(5) * fontScale;
  doc.rect(margin, doc.y, contentWidth, headerHeight).fill(COLOR_NAVY);
  let colX = margin;
  doc.fontSize(7 * fontScale).font('Helvetica-Bold').fillColor(COLOR_WHITE);
  columns.forEach((col) => {
    const colWidth = contentWidth * col.width;
    doc.text(col.label, colX + 2, doc.y + 1.5, { width: colWidth - 3, align: col.key === 'name' ? 'left' : 'right' });
    colX += colWidth;
  });
  doc.y += headerHeight;
  doc.x = margin;

  doc.font('Helvetica').fillColor(COLOR_NAVY);
  items.forEach((item, index) => {
    const rowValues = {
      name: item.product_name,
      qty: String(item.quantity),
      price: formatCurrency(item.unit_price),
      discount: Number(item.discount_amount) > 0 ? `-${formatCurrency(item.discount_amount)}` : '-',
      total: formatCurrency(item.line_total),
    };

    // Product names longer than their column need a second line — measured
    // first so the row background/height can account for it, rather than
    // letting pdfkit's own text wrap silently overlap the next row.
    const nameWidth = contentWidth * columns[0].width - 3;
    const nameHeight = doc.fontSize(7.5 * fontScale).heightOfString(rowValues.name, { width: nameWidth });
    const rowHeight = Math.max(nameHeight, mm(4.5) * fontScale) + mm(1.5) * fontScale;

    if (index % 2 === 1) doc.rect(margin, doc.y, contentWidth, rowHeight).fill(COLOR_LIGHT_GRAY);
    doc.fillColor(COLOR_NAVY);

    let cellX = margin;
    const rowY = doc.y + mm(0.8) * fontScale;
    columns.forEach((col) => {
      const colWidth = contentWidth * col.width;
      doc.fontSize(7.5 * fontScale).text(rowValues[col.key], cellX + 2, rowY, {
        width: colWidth - 3,
        align: col.key === 'name' ? 'left' : 'right',
      });
      cellX += colWidth;
    });

    doc.y += rowHeight;
    doc.x = margin;
  });

  doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).strokeColor(COLOR_BORDER).stroke();
  doc.moveDown(0.4);
}

function totalsRow(doc, label, value, { contentWidth, margin, fontScale, bold = false, color = COLOR_NAVY }) {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize((bold ? 9.5 : 8) * fontScale).fillColor(color);
  const y = doc.y;
  doc.text(label, margin, y, { width: contentWidth * 0.55, align: 'left' });
  doc.text(value, margin + contentWidth * 0.55, y, { width: contentWidth * 0.45, align: 'right' });
  doc.moveDown(0.15);
}

// Preview/Print/Download all render this same document per an existing
// convention — the browser's print dialog matches the actual roll width at
// print time. sizeKey selects between three real paper shapes (58mm/80mm
// thermal, A4 full page) rather than stretching one layout to fit all
// three; default stays 80mm, matching every receipt printed before this
// redesign. qrVerificationEnabled defaults false — an existing install's
// receipt is unchanged until an admin opts in via System Settings.
export async function buildReceiptPdf(sale, company, sizeKey = '80', qrVerificationEnabled = false) {
  const { width: pageWidth, margin, fontScale } = resolvePageSize(sizeKey);
  // A4's own real height; the two thermal widths use the same fixed
  // length pdfkit needs a concrete page size for — a true continuous roll
  // has no fixed height, this is just tall enough for a typical receipt.
  const pageHeight = mm(297);
  const contentWidth = pageWidth - margin * 2;

  const doc = new PDFDocument({ size: [pageWidth, pageHeight], margin });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const logoPath = resolveLocalLogoPath(company?.logo_path);
  if (logoPath) {
    try {
      const logoWidth = Math.min(mm(20) * fontScale, contentWidth * 0.4);
      doc.image(logoPath, margin + (contentWidth - logoWidth) / 2, doc.y, { width: logoWidth });
      doc.moveDown(0.3);
    } catch (err) {
      logger.warn('Receipt PDF: failed to embed company logo, falling back to text-only header', { error: err.message });
    }
  }

  doc.fontSize(12 * fontScale).font('Helvetica-Bold').fillColor(COLOR_NAVY)
    .text(company?.company_name || 'Clix Sales System', margin, doc.y, { width: contentWidth, align: 'center' });
  doc.font('Helvetica').fontSize(7 * fontScale).fillColor(COLOR_GRAY);

  const addressLine = formatCompanyAddress(company);
  if (addressLine) doc.text(addressLine, { width: contentWidth, align: 'center' });
  const contactLine = [company?.phone, company?.email].filter(Boolean).join('  ·  ');
  if (contactLine) doc.text(contactLine, { width: contentWidth, align: 'center' });

  doc.moveDown(0.3);
  doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).strokeColor(COLOR_GREEN).lineWidth(1.5).stroke();
  doc.lineWidth(1);
  doc.moveDown(0.4);

  doc.fontSize(8 * fontScale).font('Helvetica').fillColor(COLOR_NAVY);
  doc.text(`Receipt: ${sale.sale_number}`, { width: contentWidth });
  doc.text(`Date: ${new Date(sale.created_at).toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' })}`, { width: contentWidth });
  doc.text(`Branch: ${sale.branch_name}`, { width: contentWidth });
  doc.text(`Cashier: ${sale.cashier_first_name} ${sale.cashier_last_name}`, { width: contentWidth });
  doc.text(`Customer: ${sale.customer_first_name ? `${sale.customer_first_name} ${sale.customer_last_name}` : 'Walk-in'}`, { width: contentWidth });

  doc.moveDown(0.3);
  doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).strokeColor(COLOR_BORDER).stroke();
  doc.moveDown(0.4);

  drawItemsTable(doc, sale.items, { pageWidth, margin, contentWidth, fontScale });

  const taxAmount = Number(sale.tax_amount) || 0;
  totalsRow(doc, 'Subtotal', formatCurrency(sale.subtotal), { contentWidth, margin, fontScale });
  if (Number(sale.discount_amount) > 0) {
    totalsRow(doc, 'Discount', `-${formatCurrency(sale.discount_amount)}`, { contentWidth, margin, fontScale });
  }
  if (taxAmount > 0) {
    totalsRow(doc, 'Tax', formatCurrency(taxAmount), { contentWidth, margin, fontScale });
  }
  totalsRow(doc, 'Grand Total', formatCurrency(sale.total_amount), { contentWidth, margin, fontScale, bold: true, color: COLOR_GREEN });

  doc.moveDown(0.2);
  doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).strokeColor(COLOR_BORDER).stroke();
  doc.moveDown(0.3);

  const methodLabels = [...new Set(sale.payments.map((p) => PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method))];
  totalsRow(doc, 'Payment Method', methodLabels.join(', '), { contentWidth, margin, fontScale });

  const cashPayment = sale.payments.find((p) => p.payment_method === 'cash');
  if (cashPayment) {
    totalsRow(doc, 'Cash Received', formatCurrency(cashPayment.amount), { contentWidth, margin, fontScale });
  }
  const totalPaid = sale.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = totalPaid - Number(sale.total_amount);
  totalsRow(doc, 'Balance', formatCurrency(Math.abs(balance)), { contentWidth, margin, fontScale });

  if (qrVerificationEnabled) {
    try {
      const verificationQr = await buildVerificationQrBuffer(sale);
      const qrSize = Math.min(mm(18) * fontScale, contentWidth * 0.35);
      doc.moveDown(0.3);
      doc.image(verificationQr, margin + (contentWidth - qrSize) / 2, doc.y, { width: qrSize });
      doc.y += qrSize + mm(1);
      doc.fontSize(6 * fontScale).font('Helvetica').fillColor(COLOR_GRAY)
        .text('Scan to verify this receipt', { width: contentWidth, align: 'center' });
    } catch (err) {
      logger.warn('Receipt PDF: failed to generate verification QR, omitting it', { error: err.message });
    }
  }

  doc.moveDown(0.4);
  doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).strokeColor(COLOR_GREEN).lineWidth(1.5).stroke();
  doc.lineWidth(1);
  doc.moveDown(0.4);

  doc.fontSize(8 * fontScale).font('Helvetica-Bold').fillColor(COLOR_NAVY)
    .text(company?.receipt_footer || 'Thank you for your business!', { width: contentWidth, align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(6.5 * fontScale).font('Helvetica').fillColor(COLOR_GRAY)
    .text(`Powered by ${company?.company_name || 'Clix Sales System'}`, { width: contentWidth, align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}
