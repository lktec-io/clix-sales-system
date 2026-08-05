import apiClient from './apiClient';
import { downloadBlob } from '../utils/exportCsv';

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function getPlans() {
  const { data } = await apiClient.get('/billing/plans');
  return data.data;
}

export async function getMySubscription() {
  const { data } = await apiClient.get('/billing/me/subscription');
  return data.data;
}

export async function listMyHistory(params) {
  const { data } = await apiClient.get('/billing/me/history', { params });
  return data.data;
}

export async function listMyInvoices(params) {
  const { data } = await apiClient.get('/billing/me/invoices', { params });
  return data.data;
}

export async function getMyInvoice(id) {
  const { data } = await apiClient.get(`/billing/me/invoices/${id}`);
  return data.data;
}

export async function viewMyInvoicePdf(id) {
  const { data } = await apiClient.get(`/billing/me/invoices/${id}/pdf`, { responseType: 'blob' });
  openPdfBlob(data);
}

export async function downloadMyInvoicePdf(id, invoiceNumber) {
  const { data } = await apiClient.get(`/billing/me/invoices/${id}/pdf`, { responseType: 'blob' });
  downloadBlob(`${invoiceNumber || `Invoice-${id}`}.pdf`, data);
}
