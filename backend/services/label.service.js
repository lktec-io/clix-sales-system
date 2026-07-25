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

const COLOR_INK = '#111111';
const COLOR_MUTED = '#6B7280';
const COLOR_BORDER = '#E5E7EB';

function resolveLocalLogoPath(logoPath) {
  if (!logoPath || !logoPath.startsWith('/uploads/')) return null;
  const absPath = path.join(UPLOADS_ROOT, logoPath.replace('/uploads/', ''));
  return fs.existsSync(absPath) ? absPath : null;
}

// Logo (small) top-left, QR filling most of the label (the spec's explicit
// "QR Code must occupy most of the label" / "easy to scan even from
// distance"), Name/Code/Price stacked underneath in a compact block. No
// barcode, no branch line, no other field — exactly the five things the
// spec allows and nothing else.
function drawLabel(doc, { x, y, width, height, logoPath, product, qrImageBuffer }) {
  doc.roundedRect(x, y, width, height, mm(1)).stroke(COLOR_BORDER);

  const pad = mm(2);
  const innerX = x + pad;
  const innerWidth = width - pad * 2;

  const logoSize = mm(4.5);
  if (logoPath) {
    try {
      doc.image(logoPath, innerX, y + pad, { width: logoSize, height: logoSize });
    } catch (err) {
      logger.warn('Label PDF: failed to embed company logo, continuing without it', { error: err.message });
    }
  }

  // QR takes the majority of the label's height — square, capped by
  // whichever of width/remaining-height is tighter, with its own quiet
  // zone from `pad` plus the QR image's own built-in margin (see
  // qrCode.service.js: margin 4 modules already baked into the PNG).
  const qrTop = y + pad + logoSize + mm(1.5);
  const qrMaxHeight = height * 0.58;
  const qrSize = Math.min(innerWidth, qrMaxHeight);
  const qrX = x + (width - qrSize) / 2;
  doc.image(qrImageBuffer, qrX, qrTop, { width: qrSize, height: qrSize });

  let textY = qrTop + qrSize + mm(2);
  doc.fontSize(Math.max(7, height * 0.11)).font('Helvetica-Bold').fillColor(COLOR_INK)
    .text(product.name, innerX, textY, { width: innerWidth, align: 'center', ellipsis: true });
  textY += mm(4);

  doc.fontSize(Math.max(6, height * 0.08)).font('Helvetica').fillColor(COLOR_MUTED)
    .text(product.code, innerX, textY, { width: innerWidth, align: 'center', ellipsis: true });
  textY += mm(3.5);

  doc.fontSize(Math.max(8, height * 0.13)).font('Helvetica-Bold').fillColor(COLOR_INK)
    .text(formatCurrency(product.selling_price), innerX, textY, { width: innerWidth, align: 'center' });
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
