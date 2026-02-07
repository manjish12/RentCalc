import express from 'express';
import {
  getNotifications,
  createNotification,
  markAllAsRead,
  deleteNotification,
  getNotificationCount
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.get('/count', getNotificationCount);
router.post('/', createNotification);
router.put('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);

export default router;