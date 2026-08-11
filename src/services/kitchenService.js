import apiClient from './apiClient';

export async function getKitchenQueue() {
  const { data } = await apiClient.get('/kitchen/queue');
  return data.data;
}

export async function updateItemStatus(itemId, kitchenStatus) {
  const { data } = await apiClient.patch(`/kitchen/items/${itemId}/status`, { kitchenStatus });
  return data.data;
}
