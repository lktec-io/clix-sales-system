import apiClient from './apiClient';

export async function listAccounts(params) {
  const { data } = await apiClient.get('/savings', { params });
  return data.data;
}

export async function getAccount(id) {
  const { data } = await apiClient.get(`/savings/${id}`);
  return data.data;
}

export async function getAccountTransactions(id, params) {
  const { data } = await apiClient.get(`/savings/${id}/transactions`, { params });
  return data.data;
}

export async function openAccount(payload) {
  const { data } = await apiClient.post('/savings', payload);
  return data.data;
}

export async function recordTransaction(id, payload) {
  const { data } = await apiClient.post(`/savings/${id}/transactions`, payload);
  return data.data;
}
