import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import { getInsights } from '../controllers/insightsController.js';

const router = express.Router();

// Get AI-powered insights
// Caching for 1 hour approx, but let's keep it fresh for now or short cache
// Since it uses OPENAI which is expensive/slow, we should cache it per user.
// Assuming cacheMiddleware supports user-based caching.
// For now, no cache or short cache to ensure fresh data.
router.get('/', protect, timezoneMiddleware, getInsights);

export default router;
