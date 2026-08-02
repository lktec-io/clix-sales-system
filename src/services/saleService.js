import apiClient from './apiClient';
import { downloadBlob } from '../utils/exportCsv';
import i18n from '../i18n';

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function listSales(params) {
  const { data } = await apiClient.get('/sales', { params });
  return data.data;
}

export async function getSale(id) {
  const { data } = await apiClient.get(`/sales/${id}`);
  return data.data;
}

export async function checkout(payload) {
  const { data } = await apiClient.post('/sales', payload);
  return data.data;
}

// "Print" opens the receipt in a new tab so the browser's own PDF viewer
// (and its print icon/Ctrl+P) handles the actual print dialog. size selects
// the paper shape the PDF itself is laid out for (58/80mm thermal or a4) —
// defaults to '80' server-side, matching every receipt printed before this
// option existed.
export async function printReceipt(id, size) {
  const { data } = await apiClient.get(`/sales/${id}/receipt`, { params: { size, locale: i18n.language }, responseType: 'blob' });
  openPdfBlob(data);
}

// "Download PDF" is a distinct, separately-labelled action from Print
// (spec: "Provide: Print, Download PDF, New Sale") — triggers a real file
// save via the same <a download> pattern the Reports exports use, not
// another new-tab open a user would have to manually save from.
export async function downloadReceiptPdf(id, saleNumber, size) {
  const { data } = await apiClient.get(`/sales/${id}/receipt`, { params: { size, locale: i18n.language }, responseType: 'blob' });
  downloadBlob(`${saleNumber || `Receipt-${id}`}.pdf`, data);
}
