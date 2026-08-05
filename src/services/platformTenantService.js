import platformApiClient from './platformApiClient';

export async function listTenants(params) {
  const { data } = await platformApiClient.get('/tenants', { params });
  return data.data;
}

export async function getTenant(id) {
  const { data } = await platformApiClient.get(`/tenants/${id}`);
  return data.data;
}

export async function listTenantUsers(id, params) {
  const { data } = await platformApiClient.get(`/tenants/${id}/users`, { params });
  return data.data;
}

export async function suspendTenant(id, reason) {
  const { data } = await platformApiClient.post(`/tenants/${id}/suspend`, { reason });
  return data.data;
}

export async function activateTenant(id) {
  const { data } = await platformApiClient.post(`/tenants/${id}/activate`);
  return data.data;
}

export async function extendTrial(id, days) {
  const { data } = await platformApiClient.post(`/tenants/${id}/extend-trial`, { days });
  return data.data;
}

export async function reduceTrial(id, days) {
  const { data } = await platformApiClient.post(`/tenants/${id}/reduce-trial`, { days });
  return data.data;
}

export async function resetTrial(id, days) {
  const { data } = await platformApiClient.post(`/tenants/${id}/reset-trial`, { days });
  return data.data;
}

export async function activateSubscription(id) {
  const { data } = await platformApiClient.post(`/tenants/${id}/activate-subscription`);
  return data.data;
}

export async function expireImmediately(id) {
  const { data } = await platformApiClient.post(`/tenants/${id}/expire`);
  return data.data;
}
