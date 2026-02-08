import express from 'express';
import { getMessages, sendMessage, markMessagesRead } from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/:otherUserId', getMessages);
router.post('/', sendMessage);
router.put('/read', markMessagesRead); // New Route

export default router;