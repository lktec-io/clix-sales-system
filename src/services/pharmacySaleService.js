import apiClient from './apiClient';

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
