 import express from 'express';
import { getYears, addYear, deleteYear } from '../controllers/yearController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('owner')); // Only owners manage years

router.get('/', getYears);
router.post('/', addYear);
router.delete('/:id', deleteYear);

export default router;