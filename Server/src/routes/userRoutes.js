// routes/userRoutes.js
import express from 'express';
import { 
  getUsers, 
  getUser, 
  deleteUser, 
  getQR, 
  uploadQR, 
  resetTenantPassword,
  updateProfile,
  savePushToken,
  clearPushToken,
  getNotifications,
  markNotificationAsRead
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getUsers);
router.get('/:id', getUser);
router.delete('/:id', deleteUser);
router.get('/:id/qr', getQR);
router.post('/qr', uploadQR);
router.post('/push-token', savePushToken);
router.delete('/push-token', clearPushToken);
router.put('/reset-password', resetTenantPassword);
router.put('/profile', updateProfile);
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationAsRead);

export default router;