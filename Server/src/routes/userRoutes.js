import express from 'express';
import { getUsers, getUser, deleteUser, getQR, uploadQR } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getUsers);
router.get('/:id', getUser);
router.delete('/:id', deleteUser);
router.get('/:id/qr', getQR);
router.post('/qr', uploadQR);

export default router;