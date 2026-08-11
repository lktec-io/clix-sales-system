import apiClient from './apiClient';

export async function getPaymentMethods() {
  const { data } = await apiClient.get('/billing/payment-methods');
  return data.data;
}

export async function checkout({ planId, billingCycle, phoneNumber, mnoNetwork }) {
  const { data } = await apiClient.post('/billing/checkout', { planId, billingCycle, phoneNumber, mnoNetwork });
  return data.data;
}

export async function listMyPayments(params) {
  const { data } = await apiClient.get('/billing/me/payments', { params });
  return data.data;
}
