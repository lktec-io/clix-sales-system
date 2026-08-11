import apiClient from './apiClient';

export async function getSalesSummary() {
  const { data } = await apiClient.get('/restaurant/orders/summary');
  return data.data;
}

export async function getRecentOrders(limit) {
  const { data } = await apiClient.get('/restaurant/orders/recent', { params: { limit } });
  return data.data;
}

export async function listOrders(params) {
  const { data } = await apiClient.get('/restaurant/orders', { params });
  return data.data;
}

export async function getOrder(id) {
  const { data } = await apiClient.get(`/restaurant/orders/${id}`);
  return data.data;
}

export async function createOrder(payload) {
  const { data } = await apiClient.post('/restaurant/orders', payload);
  return data.data;
}

export async function sendToKitchen(id) {
  const { data } = await apiClient.post(`/restaurant/orders/${id}/send-to-kitchen`);
  return data.data;
}

export async function markServed(id) {
  const { data } = await apiClient.post(`/restaurant/orders/${id}/serve`);
  return data.data;
}

export async function recordPayment(id, paymentMethod) {
  const { data } = await apiClient.post(`/restaurant/orders/${id}/payment`, { paymentMethod });
  return data.data;
}

export async function cancelOrder(id) {
  const { data } = await apiClient.post(`/restaurant/orders/${id}/cancel`);
  return data.data;
}
