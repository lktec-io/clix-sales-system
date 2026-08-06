import platformApiClient from './platformApiClient';

export async function listTemplates() {
  const { data } = await platformApiClient.get('/templates');
  return data.data;
}

export async function getTemplateDetail(id) {
  const { data } = await platformApiClient.get(`/templates/${id}`);
  return data.data;
}

export async function createTemplate(payload) {
  const { data } = await platformApiClient.post('/templates', payload);
  return data.data;
}

export async function updateTemplate(id, payload) {
  const { data } = await platformApiClient.put(`/templates/${id}`, payload);
  return data.data;
}

export async function duplicateTemplate(id, payload) {
  const { data } = await platformApiClient.post(`/templates/${id}/duplicate`, payload);
  return data.data;
}

export async function activateTemplate(id) {
  const { data } = await platformApiClient.post(`/templates/${id}/activate`);
  return data.data;
}

export async function deactivateTemplate(id) {
  const { data } = await platformApiClient.post(`/templates/${id}/deactivate`);
  return data.data;
}

export async function archiveTemplate(id) {
  const { data } = await platformApiClient.post(`/templates/${id}/archive`);
  return data.data;
}

export async function setTemplateModules(id, modules) {
  const { data } = await platformApiClient.put(`/templates/${id}/modules`, { modules });
  return data.data;
}

export async function setTemplateDefaultSetting(id, key, value, dataType) {
  const { data } = await platformApiClient.put(`/templates/${id}/settings`, { key, value, dataType });
  return data.data;
}
