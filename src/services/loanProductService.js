import apiClient from './apiClient';

export async function listActiveLoanProducts() {
  const { data } = await apiClient.get('/loan-products/active');
  return data.data;
}

export async function listLoanProducts(params) {
  const { data } = await apiClient.get('/loan-products', { params });
  return data.data;
}

export async function getLoanProduct(id) {
  const { data } = await apiClient.get(`/loan-products/${id}`);
  return data.data;
}

export async function createLoanProduct(payload) {
  const { data } = await apiClient.post('/loan-products', payload);
  return data.data;
}

export async function updateLoanProduct(id, payload) {
  const { data } = await apiClient.put(`/loan-products/${id}`, payload);
  return data.data;
}

export async function setLoanProductStatus(id, status) {
  const { data } = await apiClient.patch(`/loan-products/${id}/status`, { status });
  return data.data;
}

export async function deleteLoanProduct(id) {
  await apiClient.delete(`/loan-products/${id}`);
}
