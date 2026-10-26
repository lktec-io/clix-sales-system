// Prints a small standalone document (receipt, schedule) in its own window
// so the app shell never ends up on paper.

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const PRINT_CSS = `
  * { box-sizing: border-box; border-radius: 5px; }
  body { margin: 24px; font: 500 13px/1.5 Inter, system-ui, sans-serif; color: #1e293b; }
  h1 { margin: 0 0 4px; font: 700 18px/1.3 'Plus Jakarta Sans', Inter, sans-serif; color: #0f172a; }
  .muted { color: #475569; }
  .mono, td.num, th.num { font-family: 'JetBrains Mono', ui-monospace, monospace; text-align: right; }
  table { width: 100%; margin-top: 16px; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; border-radius: 0; }
  th { font-size: 11px; letter-spacing: 0.03em; text-transform: uppercase; color: #475569; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 16px 0; }
  dt { color: #475569; }
  dd { margin: 0; font-weight: 600; }
  .total { margin-top: 12px; padding: 12px; background: #ecfdf5; color: #064e3b; font-size: 16px; font-weight: 700; }
`;

export function printDocument(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
