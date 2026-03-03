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
  savePushToken 
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
router.put('/reset-password', resetTenantPassword);
// ✅ NEW: Update profile route
router.put('/profile', updateProfile);

export default router;