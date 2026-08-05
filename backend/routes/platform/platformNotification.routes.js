import { Router } from 'express';
import * as platformNotificationController from '../../controllers/platformNotification.controller.js';
import { authenticatePlatform } from '../../middlewares/authenticatePlatform.js';

const router = Router();

router.use(authenticatePlatform);

router.get('/', platformNotificationController.list);
router.get('/unread-count', platformNotificationController.unreadCount);
router.patch('/:id/read', platformNotificationController.markRead);
router.patch('/read-all', platformNotificationController.markAllRead);

export default router;
