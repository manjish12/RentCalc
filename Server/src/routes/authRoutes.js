// routes/authRoutes.js
import express from 'express';
import { 
  register, 
  login, 
  logout,
  getProfile, 
  changePassword, 
  getPasswordHistory,
  deleteAccount
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/profile', protect, getProfile);
router.put('/change-password', protect, changePassword);
router.get('/password-history', protect, getPasswordHistory);
router.delete('/account', protect, deleteAccount);

export default router;