import { ApiError } from '../utils/apiError.js';
import * as platformNotificationRepository from '../repositories/platformNotification.repository.js';

export async function listNotifications(platformAdminId, query) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await platformNotificationRepository.findAllForAdmin({
    platformAdminId, page, limit, status: query.status,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getUnreadCount(platformAdminId) {
  return platformNotificationRepository.getUnreadCount(platformAdminId);
}

export async function markRead(id, platformAdminId) {
  const updated = await platformNotificationRepository.markRead(id, platformAdminId);
  if (!updated) throw new ApiError(404, 'Notification not found');
}

export async function markAllRead(platformAdminId) {
  await platformNotificationRepository.markAllRead(platformAdminId);
}
