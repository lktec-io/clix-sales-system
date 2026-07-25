import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import { ApiError } from '../utils/apiError.js';
import * as productRepository from '../repositories/product.repository.js';
import * as qrCodeService from './qrCode.service.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const MM_TO_PT = 2.83465;
const mm = (value) => value * MM_TO_PT;

// Shrunk from the previous 40x25 / 60x35 / 90x50 — "reduce printing cost /
// reduce label size significantly" per spec, while still leaving enough
// room for a logo, name, price, SKU, QR, and a real scannable barcode.
// Real standalone thermal sticker sizes, not sized around an A4 sheet grid
// (see PAGE_WIDTH/HEIGHT below — the grid is just how multiple labels are
// laid out for cutting on a normal printer; the label dimensions
// themselves are what a thermal label roll would actually use).
const LABEL_SIZES = {
  small: { width: 30, height: 20 },
  medium: { width: 45, height: 28 },
  large: { width: 65, height: 40 },
};

const PAGE_WIDTH = mm(210); // A4
const PAGE_HEIGHT = mm(297);
const PAGE_MARGIN = mm(8);
const LABEL_GAP = mm(3);

const COLOR_INK = '#111111';
const COLOR_MUTED = '#6B7280';
const COLOR_BORDER = '#E5E7EB';

function resolveLocalLogoPath(logoPath) {
  if (!logoPath || !logoPath.startsWith('/uploads/')) return null;
  const absPath = path.join(UPLOADS_ROOT, logoPath.replace('/uploads/', ''));
  return fs.existsSync(absPath) ? absPath : null;
}

// CODE128 — handles this app's alphanumeric product codes (e.g.
// "CRT-2026-00001") directly, unlike EAN/UPC which are numeric-only and
// fixed-length. bwip-js's height/paddingwidth/paddingheight are already in
// millimeters, so the generated image drops straight into the pdfkit
// layout below at the exact physical size requested — no rescaling, no
// distortion. scale controls the pixel density (crisper at print
// resolution, not just stretched), and the padding *inside* the image
// itself is the first of two quiet-zone margins — drawLabel below leaves
// more space again around where this gets placed.
async function generateBarcodeBuffer(code, { widthMm, heightMm }) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: code,
    scale: 4,
    width: widthMm,
    height: heightMm,
    includetext: false,
    backgroundcolor: 'FFFFFF',
    barcolor: '000000',
    paddingwidth: 1,
    paddingheight: 0.5,
  });
}

function drawLabel(doc, { x, y, width, height, logoPath, product, qrImageBuffer, barcodeBuffer }) {
  doc.roundedRect(x, y, width, height, mm(1)).stroke(COLOR_BORDER);

  const pad = mm(1.5);
  const innerX = x + pad;
  const innerWidth = width - pad * 2;

  // Top strip: tiny logo (if configured) + product name, one line, ellipsis
  // rather than wrapping — there's no room on a label this size for a
  // second line without pushing the QR/barcode into cramped territory.
  const topHeight = height * 0.22;
  let nameX = innerX;
  let nameWidth = innerWidth;
  if (logoPath) {
    try {
      doc.image(logoPath, innerX, y + pad, { width: topHeight - pad, height: topHeight - pad });
      nameX = innerX + (topHeight - pad) + mm(1);
      nameWidth = innerWidth - (topHeight - pad) - mm(1);
    } catch (err) {
      logger.warn('Label PDF: failed to embed company logo, continuing without it', { error: err.message });
    }
  }
  doc.fontSize(Math.max(6, height * 0.16)).font('Helvetica-Bold').fillColor(COLOR_INK)
    .text(product.name, nameX, y + pad, { width: nameWidth, height: topHeight - pad, ellipsis: true });

  // Middle strip: QR on the left (square, generous quiet zone from its own
  // margin), price + SKU stacked on the right.
  const middleTop = y + topHeight + pad;
  const middleHeight = height * 0.48;
  const qrSize = Math.min(middleHeight, width * 0.42);
  doc.image(qrImageBuffer, innerX, middleTop, { width: qrSize, height: qrSize });

  const priceX = innerX + qrSize + mm(2);
  const priceWidth = innerWidth - qrSize - mm(2);
  doc.fontSize(Math.max(8, height * 0.22)).font('Helvetica-Bold').fillColor(COLOR_INK)
    .text(formatCurrency(product.selling_price), priceX, middleTop + mm(1), { width: priceWidth });
  doc.fontSize(Math.max(5, height * 0.12)).font('Helvetica').fillColor(COLOR_MUTED)
    .text(product.code, priceX, middleTop + middleHeight - mm(4), { width: priceWidth });

  // Bottom strip: the barcode spans the full usable width — a 1D symbol
  // needs horizontal room to stay scannable far more than it needs height,
  // so this is where the label's width budget goes, not split evenly with
  // anything else.
  const barcodeTop = middleTop + middleHeight + mm(1);
  const barcodeHeight = height - (barcodeTop - y) - pad;
  if (barcodeBuffer && barcodeHeight > mm(3)) {
    doc.image(barcodeBuffer, innerX, barcodeTop, { width: innerWidth, height: barcodeHeight });
  }
}

export async function buildLabelsPdf(productIds, branchName, sizeKey, company) {
  if (!productIds?.length) throw new ApiError(400, 'Select at least one product');

  const size = LABEL_SIZES[sizeKey] || LABEL_SIZES.medium;
  const labelWidth = mm(size.width);
  const labelHeight = mm(size.height);
  const logoPath = resolveLocalLogoPath(company?.logo_path);

  const columns = Math.max(1, Math.floor((PAGE_WIDTH - 2 * PAGE_MARGIN + LABEL_GAP) / (labelWidth + LABEL_GAP)));
  const rows = Math.max(1, Math.floor((PAGE_HEIGHT - 2 * PAGE_MARGIN + LABEL_GAP) / (labelHeight + LABEL_GAP)));
  const perPage = columns * rows;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, autoFirstPage: false });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  for (let i = 0; i < productIds.length; i += 1) {
    const product = await productRepository.findById(productIds[i]);
    if (!product) continue;

    const qrImageBuffer = await qrCodeService.getQrImageBuffer(product.id);
    // Barcode's physical width matches the label minus margins so it's
    // generated at exactly the size it'll be printed at, not stretched
    // afterward — a barcode distorted to fit widens/narrows its bars
    // unevenly, which is exactly what breaks a handheld scanner's read.
    const barcodeWidthMm = size.width - 2 * 1.5 * 2;
    const barcodeHeightMm = size.height * 0.24;
    let barcodeBuffer = null;
    try {
      barcodeBuffer = await generateBarcodeBuffer(product.code, { widthMm: Math.max(barcodeWidthMm, 15), heightMm: Math.max(barcodeHeightMm, 4) });
    } catch (err) {
      logger.warn('Label PDF: failed to generate barcode, label will omit it', { productId: product.id, error: err.message });
    }

    const positionInPage = i % perPage;
    if (positionInPage === 0) doc.addPage();

    const col = positionInPage % columns;
    const row = Math.floor(positionInPage / columns);
    const x = PAGE_MARGIN + col * (labelWidth + LABEL_GAP);
    const y = PAGE_MARGIN + row * (labelHeight + LABEL_GAP);

    drawLabel(doc, { x, y, width: labelWidth, height: labelHeight, logoPath, product, qrImageBuffer, barcodeBuffer });

    if (branchName) {
      doc.fontSize(Math.max(4, size.height * 0.09)).fillColor(COLOR_MUTED)
        .text(branchName, x + mm(1.5), y + labelHeight - mm(2.2), { width: labelWidth - mm(3) });
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      logger.info('PDF generated', { productCount: productIds.length });
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}
