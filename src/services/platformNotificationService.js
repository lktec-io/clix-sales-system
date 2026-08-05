import platformApiClient from './platformApiClient';

export async function listNotifications(params) {
  const { data } = await platformApiClient.get('/notifications', { params });
  return data.data;
}

export async function getUnreadCount() {
  const { data } = await platformApiClient.get('/notifications/unread-count');
  return data.data.count;
}

export async function markNotificationRead(id) {
  await platformApiClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await platformApiClient.patch('/notifications/read-all');
}
