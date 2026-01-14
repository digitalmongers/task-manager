import express from 'express';
import SecurityController from '../controllers/securityController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for security endpoints
const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 requests per window
  message: {
    success: false,
    message: 'Too many security requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require authentication
router.use(protect);
router.use(timezoneMiddleware);

// Get login activity history
router.get(
  '/login-activity',
  securityLimiter,
  asyncHandler(SecurityController.getLoginActivity.bind(SecurityController))
);

// Get active devices/sessions
router.get(
  '/active-devices',
  securityLimiter,
  asyncHandler(SecurityController.getActiveDevices.bind(SecurityController))
);

// Logout from a specific device
router.post(
  '/logout-device',
  securityLimiter,
  asyncHandler(SecurityController.logoutDevice.bind(SecurityController))
);

// Logout from all devices
router.post(
  '/logout-all',
  securityLimiter,
  asyncHandler(SecurityController.logoutAllDevices.bind(SecurityController))
);

// Update device name
router.patch(
  '/device-name',
  securityLimiter,
  asyncHandler(SecurityController.updateDeviceName.bind(SecurityController))
);

// Refresh current session
router.post(
  '/refresh-session',
  securityLimiter,
  asyncHandler(SecurityController.refreshSession.bind(SecurityController))
);

export default router;
