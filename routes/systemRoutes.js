import express from 'express';
import { getSystemMetrics } from '../controllers/systemController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Get real-time metrics (Admin only)
router.get('/metrics', protect, authorize('admin'), getSystemMetrics);

export default router;
