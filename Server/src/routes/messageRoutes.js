// routes/messageRoutes.js
import express from 'express';
import { 
  getMessages, 
  sendMessage, 
  markMessagesRead, 
  getUnreadCount,
  deleteMessage 
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Must be before /:otherUserId to avoid conflict
router.get('/unread-count', getUnreadCount);

router.get('/:otherUserId', getMessages);
router.post('/', sendMessage);
router.put('/read', markMessagesRead);

// NEW: Delete message route
router.delete('/:messageId', deleteMessage);

export default router;