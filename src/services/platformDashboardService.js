import platformApiClient from './platformApiClient';

export async function getKpis() {
  const { data } = await platformApiClient.get('/dashboard/kpis');
  return data.data;
}

export async function getSystemStatus() {
  const { data } = await platformApiClient.get('/dashboard/system-status');
  return data.data;
}

export async function getStorageUsage() {
  const { data } = await platformApiClient.get('/dashboard/storage');
  return data.data;
}

export async function getRecentActivity(limit = 20) {
  const { data } = await platformApiClient.get('/dashboard/recent-activity', { params: { limit } });
  return data.data;
}

export async function getBillingKpis() {
  const { data } = await platformApiClient.get('/dashboard/billing-kpis');
  return data.data;
}
