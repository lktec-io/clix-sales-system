import apiClient from './apiClient';
import { downloadBlob } from '../utils/exportCsv';
import i18n from '../i18n';

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function listSales(params) {
  const { data } = await apiClient.get('/pharmacy/sales', { params });
  return data.data;
}

export async function getSale(id) {
  const { data } = await apiClient.get(`/pharmacy/sales/${id}`);
  return data.data;
}

export async function createSale(payload) {
  const { data } = await apiClient.post('/pharmacy/sales', payload);
  return data.data;
}

export async function getSalesSummary() {
  const { data } = await apiClient.get('/pharmacy/sales/summary');
  return data.data;
}

export async function getRecentSales(limit) {
  const { data } = await apiClient.get('/pharmacy/sales/recent', { params: { limit } });
  return data.data;
}

// Mirrors saleService.js#printReceipt/downloadReceiptPdf exactly — same
// receipt PDF engine, reshaped server-side for pharmacy_sales' schema (see
// pharmacySale.service.js#getSaleForReceipt).
export async function printReceipt(id, size) {
  const { data } = await apiClient.get(`/pharmacy/sales/${id}/receipt`, { params: { size, locale: i18n.language }, responseType: 'blob' });
  openPdfBlob(data);
}

export async function downloadReceiptPdf(id, saleNumber, size) {
  const { data } = await apiClient.get(`/pharmacy/sales/${id}/receipt`, { params: { size, locale: i18n.language }, responseType: 'blob' });
  downloadBlob(`${saleNumber || `Receipt-${id}`}.pdf`, data);
}
