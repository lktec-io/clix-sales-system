import platformApiClient from './platformApiClient';

export async function listModules() {
  const { data } = await platformApiClient.get('/modules');
  return data.data;
}

export async function getModule(id) {
  const { data } = await platformApiClient.get(`/modules/${id}`);
  return data.data;
}

export async function createModule(payload) {
  const { data } = await platformApiClient.post('/modules', payload);
  return data.data;
}

export async function updateModule(id, payload) {
  const { data } = await platformApiClient.put(`/modules/${id}`, payload);
  return data.data;
}

export async function activateModule(id) {
  const { data } = await platformApiClient.post(`/modules/${id}/activate`);
  return data.data;
}

export async function deactivateModule(id) {
  const { data } = await platformApiClient.post(`/modules/${id}/deactivate`);
  return data.data;
}
