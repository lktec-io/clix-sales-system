import apiClient from './apiClient';
import { downloadBlob } from '../utils/exportCsv';
import i18n from '../i18n';

export async function getReport(type, params) {
  const { data } = await apiClient.get(`/reports/${type}`, { params });
  return data.data;
}

// "Sales_Report_2026-07-15.pdf" — matches backend/services/reportConfig.js's
// buildReportFilename() exactly, so the name shown while downloading and
// the name the file actually saves as (the <a download> attribute wins
// over the server's Content-Disposition filename) agree with each other.
function buildFilename(label, extension) {
  const datePart = new Date().toISOString().slice(0, 10);
  return `${label.replace(/\s+/g, '_')}_Report_${datePart}.${extension}`;
}

// Was window.open(blobUrl) — opened the PDF in a new browser tab/preview
// instead of downloading it. downloadBlob (an <a download> click, same as
// Excel/CSV below) triggers an actual direct download with no preview tab.
export async function exportReportPdf(type, params, label) {
  const { data } = await apiClient.get(`/reports/${type}/export/pdf`, { params: { ...params, locale: i18n.language }, responseType: 'blob' });
  downloadBlob(buildFilename(label, 'pdf'), data);
}

export async function exportReportExcel(type, params, label) {
  const { data } = await apiClient.get(`/reports/${type}/export/excel`, { params: { ...params, locale: i18n.language }, responseType: 'blob' });
  downloadBlob(buildFilename(label, 'xlsx'), data);
}

export async function exportReportCsv(type, params, label) {
  const { data } = await apiClient.get(`/reports/${type}/export/csv`, { params: { ...params, locale: i18n.language }, responseType: 'blob' });
  downloadBlob(buildFilename(label, 'csv'), data);
}
