import express from 'express';
import { getMessages, sendMessage, markMessagesRead, getUnreadCount } from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/unread-count', getUnreadCount); // New Route
router.get('/:otherUserId', getMessages);
router.post('/', sendMessage);
router.put('/read', markMessagesRead);

export default router;