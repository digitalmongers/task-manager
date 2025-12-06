import express from 'express';
import AuthController from '../controllers/authController.js';
import { authValidation } from '../validators/authValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Strict rate limiter for auth attempts (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

// Stricter rate limiter for email operations (verification, forgot password)
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 attempts per hour
  message: {
    success: false,
    message: 'Too many email requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Extra strict rate limiter for password reset (prevent brute force on tokens)
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 reset attempts
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration
router.post(
  '/register',
  authLimiter,
  validate(authValidation.register),
  asyncHandler(AuthController.register.bind(AuthController))
);

// Login
router.post(
  '/login',
  authLimiter,
  validate(authValidation.login),
  asyncHandler(AuthController.login.bind(AuthController))
);

// Email verification
router.get(
  '/verify-email/:token',
  validate(authValidation.verifyEmail),
  asyncHandler(AuthController.verifyEmail.bind(AuthController))
);

// Resend verification email
router.post(
  '/resend-verification',
  emailLimiter,
  validate(authValidation.resendVerification),
  asyncHandler(AuthController.resendVerification.bind(AuthController))
);

// Forgot password - SECURED
router.post(
  '/forgot-password',
  emailLimiter, // Strict rate limiting
  validate(authValidation.forgotPassword),
  asyncHandler(AuthController.forgotPassword.bind(AuthController))
);

// Reset password - SECURED
router.post(
  '/reset-password/:token',
  resetPasswordLimiter, // Extra strict rate limiting
  validate(authValidation.resetPassword),
  asyncHandler(AuthController.resetPassword.bind(AuthController))
);

// Change password (authenticated users)
router.post(
  '/change-password',
  protect,
  validate(authValidation.changePassword),
  asyncHandler(AuthController.changePassword.bind(AuthController))
);

// Get current user
router.get(
  '/me',
  protect,
  asyncHandler(AuthController.getCurrentUser.bind(AuthController))
);

// Logout
router.post(
  '/logout',
  protect,
  asyncHandler(AuthController.logout.bind(AuthController))
);

// Refresh token
router.post(
  '/refresh-token',
  asyncHandler(AuthController.refreshToken.bind(AuthController))
);

export default router;