import express from 'express';
import PushController from '../controllers/pushController.js';
import { protect } from '../middlewares/authMiddleware.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.js';
import { pushValidation } from '../validators/pushValidation.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for push endpoints
const pushLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

/**
 * @route   GET /api/push/vapid-public-key
 * @desc    Get VAPID public key for frontend
 * @access  Public (needed for service worker registration)
 */
router.get(
  '/vapid-public-key',
  pushLimiter,
  asyncHandler(PushController.getVapidPublicKey.bind(PushController))
);

// All routes below require authentication
router.use(protect);

/**
 * @route   POST /api/push/subscribe
 * @desc    Subscribe to push notifications
 * @access  Private
 */
router.post(
  '/subscribe',
  pushLimiter,
  validate(pushValidation.subscribe),
  asyncHandler(PushController.subscribe.bind(PushController))
);

/**
 * @route   DELETE /api/push/unsubscribe
 * @desc    Unsubscribe from push notifications
 * @access  Private
 */
router.delete(
  '/unsubscribe',
  pushLimiter,
  asyncHandler(PushController.unsubscribe.bind(PushController))
);

/**
 * @route   GET /api/push/status
 * @desc    Get push subscription status
 * @access  Private
 */
router.get(
  '/status',
  pushLimiter,
  asyncHandler(PushController.getStatus.bind(PushController))
);

export default router;
