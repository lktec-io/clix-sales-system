import apiClient from './apiClient';

export async function listAvailableTables() {
  const { data } = await apiClient.get('/tables/available');
  return data.data;
}

export async function getOccupancySummary() {
  const { data } = await apiClient.get('/tables/summary');
  return data.data;
}

export async function listTables(params) {
  const { data } = await apiClient.get('/tables', { params });
  return data.data;
}

export async function getTable(id) {
  const { data } = await apiClient.get(`/tables/${id}`);
  return data.data;
}

export async function createTable(payload) {
  const { data } = await apiClient.post('/tables', payload);
  return data.data;
}

export async function updateTable(id, payload) {
  const { data } = await apiClient.put(`/tables/${id}`, payload);
  return data.data;
}

export async function setTableActive(id, isActive) {
  await apiClient.patch(`/tables/${id}/active`, { isActive });
}

export async function setTableStatus(id, status) {
  const { data } = await apiClient.patch(`/tables/${id}/status`, { status });
  return data.data;
}
