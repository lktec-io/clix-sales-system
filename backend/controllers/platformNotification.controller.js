import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as platformNotificationService from '../services/platformNotification.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await platformNotificationService.listNotifications(req.platformAdmin.id, req.query);
  return success(res, { data: { items, meta } });
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await platformNotificationService.getUnreadCount(req.platformAdmin.id);
  return success(res, { data: { count } });
});

export const markRead = asyncHandler(async (req, res) => {
  await platformNotificationService.markRead(Number(req.params.id), req.platformAdmin.id);
  return success(res, { message: 'Notification marked as read' });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await platformNotificationService.markAllRead(req.platformAdmin.id);
  return success(res, { message: 'All notifications marked as read' });
});
