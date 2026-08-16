import apiClient from './apiClient';
import { downloadBlob } from '../utils/exportCsv';

export async function listPurchases(params) {
  const { data } = await apiClient.get('/purchases', { params });
  return data.data;
}

export async function getPurchase(id) {
  const { data } = await apiClient.get(`/purchases/${id}`);
  return data.data;
}

export async function createPurchase(payload) {
  const { data } = await apiClient.post('/purchases', payload);
  return data.data;
}

export async function addSupplierPayment(payload) {
  await apiClient.post('/purchases/payments', payload);
}

export async function deletePurchase(id) {
  await apiClient.delete(`/purchases/${id}`);
}

export async function downloadImportTemplate() {
  const { data } = await apiClient.get('/purchases/import/template', { responseType: 'blob' });
  downloadBlob('Purchase_Import_Template.xlsx', data);
}

export async function previewImport(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/purchases/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function commitImport(payload) {
  const { data } = await apiClient.post('/purchases/import/commit', payload);
  return data.data;
}
