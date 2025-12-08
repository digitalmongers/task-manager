import express from "express";
import AuthController from "../controllers/authController.js";
import { authValidation } from "../validators/authValidation.js";
import validate from "../middlewares/validate.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { protect } from "../middlewares/authMiddleware.js";
import {
  cacheByUser,
  invalidateCache,
} from "../middlewares/cacheMiddleware.js";
import rateLimit from "express-rate-limit";
import upload from "../middlewares/upload.js";

const router = express.Router();

// Strict rate limiter for auth attempts (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Stricter rate limiter for email operations
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 attempts per hour
  message: {
    success: false,
    message: "Too many email requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Extra strict rate limiter for password reset
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 reset attempts
  message: {
    success: false,
    message: "Too many password reset attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration
router.post(
  "/register",
  authLimiter,
  validate(authValidation.register),
  asyncHandler(AuthController.register.bind(AuthController))
);

// Login
router.post(
  "/login",
  authLimiter,
  validate(authValidation.login),
  invalidateCache((req) =>
    req.body.email ? `user:*${req.body.email}*` : "user:*"
  ),
  asyncHandler(AuthController.login.bind(AuthController))
);

// Email verification
router.get(
  "/verify-email/:token",
  validate(authValidation.verifyEmail),
  asyncHandler(AuthController.verifyEmail.bind(AuthController))
);

// Resend verification email
router.post(
  "/resend-verification",
  emailLimiter,
  validate(authValidation.resendVerification),
  asyncHandler(AuthController.resendVerification.bind(AuthController))
);

// Forgot password
router.post(
  "/forgot-password",
  emailLimiter,
  validate(authValidation.forgotPassword),
  asyncHandler(AuthController.forgotPassword.bind(AuthController))
);

// Reset password
router.post(
  "/reset-password/:token",
  resetPasswordLimiter,
  validate(authValidation.resetPassword),
  asyncHandler(AuthController.resetPassword.bind(AuthController))
);

// Refresh token
router.post(
  "/refresh-token",
  asyncHandler(AuthController.refreshToken.bind(AuthController))
);

// Get current user profile
router.get(
  "/me",
  protect,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(AuthController.getCurrentUser.bind(AuthController))
);

// Update user profile (firstName, lastName, phoneNumber)
router.patch(
  "/profile",
  protect,
  validate(authValidation.updateProfile),
  invalidateCache((req) => `user:${req.user._id}:*`),
  asyncHandler(AuthController.updateProfile.bind(AuthController))
);

// Update profile photo (avatar)
router.put(
  "/avatar",
  protect,
  upload.single("avatar"),
  invalidateCache((req) => `user:${req.user._id}:*`),
  asyncHandler(AuthController.updateAvatar.bind(AuthController))
);

// Delete profile photo
router.delete(
  "/avatar",
  protect,
  invalidateCache((req) => `user:${req.user._id}:*`),
  asyncHandler(AuthController.deleteAvatar.bind(AuthController))
);

// Change password (authenticated users)
router.post(
  "/change-password",
  protect,
  validate(authValidation.changePassword),
  invalidateCache((req) => `user:${req.user._id}:*`),
  asyncHandler(AuthController.changePassword.bind(AuthController))
);

// Delete account (soft delete)
router.delete(
  "/account",
  protect,
  validate(authValidation.deleteAccount),
  invalidateCache((req) => `user:${req.user._id}:*`),
  asyncHandler(AuthController.deleteAccount.bind(AuthController))
);

// Logout
router.post(
  "/logout",
  protect,
  invalidateCache((req) => `user:${req.user._id}:*`),
  asyncHandler(AuthController.logout.bind(AuthController))
);

// Add these routes to your existing authRoutes.js

// ========== GOOGLE OAUTH ROUTES ==========

// Initiate Google OAuth
router.get(
  "/google",
  asyncHandler(AuthController.googleAuth.bind(AuthController))
);

// Google OAuth callback
router.get(
  "/google/callback",
  AuthController.googleCallback.bind(AuthController)
);

// Unlink Google account (requires authentication)
router.post(
  "/google/unlink",
  protect,
  validate(authValidation.unlinkGoogle),
  asyncHandler(AuthController.unlinkGoogle.bind(AuthController))
);

// Check email availability (for Google OAuth)
router.post(
  "/check-email",
  validate(authValidation.checkEmail),
  asyncHandler(AuthController.checkEmail.bind(AuthController))
);

// Add these routes to your existing authRoutes.js file
// Place them after the Google OAuth routes

// ========== FACEBOOK OAUTH ROUTES ==========

// Initiate Facebook OAuth
router.get(
  "/facebook",
  asyncHandler(AuthController.facebookAuth.bind(AuthController))
);

// Facebook OAuth callback
router.get(
  "/facebook/callback",
  AuthController.facebookCallback.bind(AuthController)
);

// Unlink Facebook account (requires authentication)
router.post(
  "/facebook/unlink",
  protect,
  validate(authValidation.unlinkFacebook),
  asyncHandler(AuthController.unlinkFacebook.bind(AuthController))
);

export default router;
