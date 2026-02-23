import express from 'express';
import { register, login, getProfile, changePassword, getPasswordHistory } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/change-password', protect, changePassword);
router.get('/password-history', protect, getPasswordHistory); // New Route

export default router;