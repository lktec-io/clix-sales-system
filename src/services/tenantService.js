import apiClient from './apiClient';

export async function register(payload) {
  const { data } = await apiClient.post('/tenants/register', payload);
  return data.data;
}

export async function getMyTenant() {
  const { data } = await apiClient.get('/tenants/me');
  return data.data;
}
