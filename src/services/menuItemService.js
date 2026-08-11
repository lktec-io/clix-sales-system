import apiClient from './apiClient';

export async function listActiveMenuItems() {
  const { data } = await apiClient.get('/menu/active');
  return data.data;
}

export async function listMenuItems(params) {
  const { data } = await apiClient.get('/menu', { params });
  return data.data;
}

export async function getMenuItem(id) {
  const { data } = await apiClient.get(`/menu/${id}`);
  return data.data;
}

export async function createMenuItem(payload) {
  const { data } = await apiClient.post('/menu', payload);
  return data.data;
}

export async function updateMenuItem(id, payload) {
  const { data } = await apiClient.put(`/menu/${id}`, payload);
  return data.data;
}

export async function deleteMenuItem(id) {
  await apiClient.delete(`/menu/${id}`);
}
