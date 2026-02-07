import express from 'express';
import { getRents, createRent, createBulkRents, updateRent, deleteRent, applyBulkPayment } from '../controllers/rentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getRents);
router.post('/', createRent);
router.post('/bulk', createBulkRents);
router.post('/bulk-payment', applyBulkPayment);
router.put('/:id', updateRent);
router.delete('/:id', deleteRent);

export default router;