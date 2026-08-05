import platformApiClient from './platformApiClient';

export async function listPlans() {
  const { data } = await platformApiClient.get('/plans');
  return data.data;
}

export async function getPlan(id) {
  const { data } = await platformApiClient.get(`/plans/${id}`);
  return data.data;
}

export async function createPlan(payload) {
  const { data } = await platformApiClient.post('/plans', payload);
  return data.data;
}

export async function updatePlan(id, payload) {
  const { data } = await platformApiClient.put(`/plans/${id}`, payload);
  return data.data;
}

export async function activatePlan(id) {
  const { data } = await platformApiClient.post(`/plans/${id}/activate`);
  return data.data;
}

export async function deactivatePlan(id) {
  const { data } = await platformApiClient.post(`/plans/${id}/deactivate`);
  return data.data;
}

export async function markRecommended(id) {
  const { data } = await platformApiClient.post(`/plans/${id}/mark-recommended`);
  return data.data;
}

export async function reorderPlans(orderedIds) {
  const { data } = await platformApiClient.post('/plans/reorder', { orderedIds });
  return data.data;
}
