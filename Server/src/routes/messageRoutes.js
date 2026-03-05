// routes/messageRoutes.js - Add test route
import express from 'express';
import { 
  getMessages, 
  sendMessage, 
  markMessagesRead, 
  getUnreadCount,
  deleteMessage,
  sendTestNotification  // Add this
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/unread-count', getUnreadCount);
router.get('/:otherUserId', getMessages);
router.post('/', sendMessage);
router.put('/read', markMessagesRead);
router.delete('/:messageId', deleteMessage);

// Add test notification route (remove in production)
router.post('/test-notification', sendTestNotification);

export default router;