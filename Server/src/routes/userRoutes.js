import express from 'express';
import { getUsers, getUser, deleteUser, getQR, uploadQR, resetTenantPassword } from '../controllers/userController.js';
import { savePushToken } from '../controllers/userController.js';
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

export default router;