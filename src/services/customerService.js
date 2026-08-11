import apiClient from './apiClient';

export async function listActiveCustomers() {
  const { data } = await apiClient.get('/customers/active');
  return data.data;
}

export async function listCustomers(params) {
  const { data } = await apiClient.get('/customers', { params });
  return data.data;
}

export async function getCustomer(id) {
  const { data } = await apiClient.get(`/customers/${id}`);
  return data.data;
}

export async function getCustomerPurchaseHistory(id, params) {
  const { data } = await apiClient.get(`/customers/${id}/purchases`, { params });
  return data.data;
}

export async function getCustomerReturnHistory(id, params) {
  const { data } = await apiClient.get(`/customers/${id}/returns`, { params });
  return data.data;
}

export async function getCustomerRepairHistory(id) {
  const { data } = await apiClient.get(`/customers/${id}/repairs`);
  return data.data;
}

export async function createCustomer(payload) {
  const { data } = await apiClient.post('/customers', payload);
  return data.data;
}

export async function updateCustomer(id, payload) {
  const { data } = await apiClient.put(`/customers/${id}`, payload);
  return data.data;
}

export async function changeCustomerStatus(id, status) {
  const { data } = await apiClient.patch(`/customers/${id}/status`, { status });
  return data.data;
}

export async function deleteCustomer(id) {
  await apiClient.delete(`/customers/${id}`);
}
