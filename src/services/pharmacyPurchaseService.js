import apiClient from './apiClient';

export async function listPurchases(params) {
  const { data } = await apiClient.get('/pharmacy/purchases', { params });
  return data.data;
}

export async function getPurchase(id) {
  const { data } = await apiClient.get(`/pharmacy/purchases/${id}`);
  return data.data;
}

export async function receiveStock(payload) {
  const { data } = await apiClient.post('/pharmacy/purchases', payload);
  return data.data;
}
