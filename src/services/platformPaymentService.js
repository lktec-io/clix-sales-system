import platformApiClient from './platformApiClient';

export async function listPayments(params) {
  const { data } = await platformApiClient.get('/payments', { params });
  return data.data;
}

export async function getPayment(paymentId) {
  const { data } = await platformApiClient.get(`/payments/${paymentId}`);
  return data.data;
}

export async function confirmPayment(paymentId) {
  const { data } = await platformApiClient.post(`/payments/${paymentId}/confirm`);
  return data.data;
}

export async function rejectPayment(paymentId, reason) {
  const { data } = await platformApiClient.post(`/payments/${paymentId}/reject`, { reason });
  return data.data;
}
