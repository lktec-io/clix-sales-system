import apiClient from './apiClient';

export async function getDashboardSummary() {
  const { data } = await apiClient.get('/repairs/summary');
  return data.data;
}

export async function getRecentRepairs(limit) {
  const { data } = await apiClient.get('/repairs/recent', { params: { limit } });
  return data.data;
}

export async function listRepairs(params) {
  const { data } = await apiClient.get('/repairs', { params });
  return data.data;
}

export async function getRepair(id) {
  const { data } = await apiClient.get(`/repairs/${id}`);
  return data.data;
}

export async function createIntake(payload) {
  const { data } = await apiClient.post('/repairs', payload);
  return data.data;
}

export async function updateDiagnosis(id, payload) {
  const { data } = await apiClient.put(`/repairs/${id}/diagnosis`, payload);
  return data.data;
}

export async function assignTechnician(id, technicianId) {
  const { data } = await apiClient.patch(`/repairs/${id}/technician`, { technicianId });
  return data.data;
}

export async function startDiagnosis(id) {
  const { data } = await apiClient.post(`/repairs/${id}/start-diagnosis`);
  return data.data;
}

export async function sendForApproval(id) {
  const { data } = await apiClient.post(`/repairs/${id}/send-for-approval`);
  return data.data;
}

export async function markUnrepairable(id, notes) {
  const { data } = await apiClient.post(`/repairs/${id}/unrepairable`, { notes });
  return data.data;
}

export async function approve(id) {
  const { data } = await apiClient.post(`/repairs/${id}/approve`);
  return data.data;
}

export async function reject(id, notes) {
  const { data } = await apiClient.post(`/repairs/${id}/reject`, { notes });
  return data.data;
}

export async function startRepair(id) {
  const { data } = await apiClient.post(`/repairs/${id}/start-repair`);
  return data.data;
}

export async function addPart(id, payload) {
  const { data } = await apiClient.post(`/repairs/${id}/parts`, payload);
  return data.data;
}

export async function markReady(id) {
  const { data } = await apiClient.post(`/repairs/${id}/ready`);
  return data.data;
}

export async function recordPayment(id, payload) {
  const { data } = await apiClient.post(`/repairs/${id}/payments`, payload);
  return data.data;
}

export async function completeCollection(id) {
  const { data } = await apiClient.post(`/repairs/${id}/complete`);
  return data.data;
}

export async function cancelRepair(id, notes) {
  const { data } = await apiClient.post(`/repairs/${id}/cancel`, { notes });
  return data.data;
}
