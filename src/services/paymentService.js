import apiClient from './apiClient';

export async function checkout({ planId, billingCycle }) {
  const { data } = await apiClient.post('/billing/checkout', { planId, billingCycle });
  return data.data;
}

export async function listMyPayments(params) {
  const { data } = await apiClient.get('/billing/me/payments', { params });
  return data.data;
}
