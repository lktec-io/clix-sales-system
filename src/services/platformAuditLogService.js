import platformApiClient from './platformApiClient';

export async function listAuditLogs(params) {
  const { data } = await platformApiClient.get('/audit-logs', { params });
  return data.data;
}
