import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { ApiError } from '../utils/apiError.js';
import * as productRepository from '../repositories/product.repository.js';
import * as qrCodeService from './qrCode.service.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const MM_TO_PT = 2.83465;
const mm = (value) => value * MM_TO_PT;

// QR-only per spec — no 1D barcode. Target sizes are the two the spec
// names directly ("50x30mm or 60x40mm depending on printer"); `large`
// keeps the existing three-key API contract (frontend/controller already
// pass size: 'small' | 'medium' | 'large') intact for a bigger sticker
// stock without inventing a fourth option nobody asked for.
const LABEL_SIZES = {
  small: { width: 50, height: 30 },
  medium: { width: 60, height: 40 },
  large: { width: 70, height: 45 },
};

const PAGE_WIDTH = mm(210); // A4
const PAGE_HEIGHT = mm(297);
// Tightened from 8/3mm — "print multiple labels efficiently with minimum
// wasted paper" — less margin/gap means more labels per sheet at a given
// size, without shrinking the labels themselves.
const PAGE_MARGIN = mm(6);
const LABEL_GAP = mm(2);

// Navy / Green / Black only, per spec — no gray, no border color.
const COLOR_NAVY = '#0B1F4D';
const COLOR_GREEN = '#10B981';
const COLOR_BLACK = '#000000';

function resolveLocalLogoPath(logoPath) {
  if (!logoPath || !logoPath.startsWith('/uploads/')) return null;
  const absPath = path.join(UPLOADS_ROOT, logoPath.replace('/uploads/', ''));
  return fs.existsSync(absPath) ? absPath : null;
}

// Fixed (not height-percentage) increments for the logo/name/code/price
// block, tuned against the *smallest* label size (50x30mm) so the block
// always leaves real room for the QR beneath it — on the larger 60x40/
// 70x45mm sizes the same fixed block just leaves proportionally more.
const LOGO_SIZE = mm(3.5);
const LOGO_GAP = mm(0.6);
const NAME_FONT = 6.5;
const NAME_LINE = mm(2.6);
const CODE_FONT = 5.5;
const CODE_LINE = mm(2.4);
const PRICE_FONT = 8.5;
const PRICE_LINE = mm(3.8);
const QR_GAP = mm(0.8);
const MIN_QR_SIZE = mm(8);

// Vertical stack, top to bottom, exactly as specified: Logo -> Product
// Name -> Product ID -> Price (large, bold) -> QR code. No border, no
// other field. QR gets whatever vertical room is left after the fixed
// text block above it (always positive — see the LOGO_SIZE.../MIN_QR_SIZE
// constants' comment), capped by the label's own width so it never
// overflows a narrow label either.
function drawLabel(doc, { x, y, width, height, logoPath, product, qrImageBuffer }) {
  const pad = mm(1.8);
  const innerX = x + pad;
  const innerWidth = width - pad * 2;
  let cursorY = y + pad;

  if (logoPath) {
    try {
      doc.image(logoPath, x + (width - LOGO_SIZE) / 2, cursorY, { width: LOGO_SIZE, height: LOGO_SIZE });
    } catch (err) {
      logger.warn('Label PDF: failed to embed company logo, continuing without it', { error: err.message });
    }
    cursorY += LOGO_SIZE + LOGO_GAP;
  }

  doc.fontSize(NAME_FONT).font('Helvetica-Bold').fillColor(COLOR_NAVY)
    .text(product.name, innerX, cursorY, { width: innerWidth, align: 'center', ellipsis: true });
  cursorY += NAME_LINE;

  doc.fontSize(CODE_FONT).font('Helvetica').fillColor(COLOR_BLACK)
    .text(product.code, innerX, cursorY, { width: innerWidth, align: 'center', ellipsis: true });
  cursorY += CODE_LINE;

  doc.fontSize(PRICE_FONT).font('Helvetica-Bold').fillColor(COLOR_GREEN)
    .text(formatCurrency(product.selling_price), innerX, cursorY, { width: innerWidth, align: 'center' });
  cursorY += PRICE_LINE + QR_GAP;

  const qrAvailableHeight = (y + height - pad) - cursorY;
  const qrSize = Math.max(Math.min(innerWidth, qrAvailableHeight), MIN_QR_SIZE);
  const qrX = x + (width - qrSize) / 2;
  doc.image(qrImageBuffer, qrX, cursorY, { width: qrSize, height: qrSize });
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

    const positionInPage = i % perPage;
    if (positionInPage === 0) doc.addPage();

    const col = positionInPage % columns;
    const row = Math.floor(positionInPage / columns);
    const x = PAGE_MARGIN + col * (labelWidth + LABEL_GAP);
    const y = PAGE_MARGIN + row * (labelHeight + LABEL_GAP);

    drawLabel(doc, { x, y, width: labelWidth, height: labelHeight, logoPath, product, qrImageBuffer });
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      logger.info('Label PDF generated', { productCount: productIds.length });
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}
