import platformApiClient from './platformApiClient';

export async function getSettings() {
  const { data } = await platformApiClient.get('/settings');
  return data.data;
}

export async function updateSettings(payload) {
  const { data } = await platformApiClient.put('/settings', payload);
  return data.data;
}
