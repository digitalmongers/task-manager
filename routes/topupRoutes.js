import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getTopupPackages, createTopupOrder } from '../controllers/topupController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/topups/packages - Get available top-up packages
router.get('/packages', getTopupPackages);

// POST /api/topups/create-order - Create Razorpay order for top-up
router.post('/create-order', createTopupOrder);

export default router;
