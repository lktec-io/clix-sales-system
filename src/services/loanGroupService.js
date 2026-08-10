import apiClient from './apiClient';

export async function listGroups(params) {
  const { data } = await apiClient.get('/groups', { params });
  return data.data;
}

export async function getGroup(id) {
  const { data } = await apiClient.get(`/groups/${id}`);
  return data.data;
}

export async function createGroup(payload) {
  const { data } = await apiClient.post('/groups', payload);
  return data.data;
}

export async function updateGroup(id, payload) {
  const { data } = await apiClient.put(`/groups/${id}`, payload);
  return data.data;
}

export async function addMember(id, customerId) {
  const { data } = await apiClient.post(`/groups/${id}/members`, { customerId });
  return data.data;
}

export async function removeMember(id, customerId) {
  const { data } = await apiClient.delete(`/groups/${id}/members/${customerId}`);
  return data.data;
}
