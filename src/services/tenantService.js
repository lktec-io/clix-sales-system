import apiClient from './apiClient';

// Public — called from the signup form before any session exists.
export async function listTemplates() {
  const { data } = await apiClient.get('/tenants/templates');
  return data.data;
}

export async function register(payload) {
  const { data } = await apiClient.post('/tenants/register', payload);
  return data.data;
}

export async function getMyTenant() {
  const { data } = await apiClient.get('/tenants/me');
  return data.data;
}
