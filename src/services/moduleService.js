import apiClient from './apiClient';

export async function getMyModules() {
  const { data } = await apiClient.get('/modules/me');
  return data.data;
}
