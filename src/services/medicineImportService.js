import apiClient from './apiClient';
import { downloadBlob } from '../utils/exportCsv';

// Pharmacy's own "Import Medicines" wrapper — mirrors purchaseService.js's
// import functions exactly (same multipart/blob patterns), pointed at the
// dedicated /medicines/import/* endpoints so this stays a distinctly
// pharmacy-branded flow rather than reusing the retail Products import.
export async function downloadImportTemplate() {
  const { data } = await apiClient.get('/medicines/import/template', { responseType: 'blob' });
  downloadBlob('Medicine_Import_Template.xlsx', data);
}

export async function previewImport(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/medicines/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function commitImport(payload) {
  const { data } = await apiClient.post('/medicines/import/commit', payload);
  return data.data;
}
