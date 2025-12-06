import express from 'express';
import AuthController from '../controllers/authController.js';
import { authValidation } from '../validators/authValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Too many email requests, please try again later',
  },
});

router.post(
  '/register',
  authLimiter,
  validate(authValidation.register),
  asyncHandler(AuthController.register.bind(AuthController))
);

router.post(
  '/login',
  authLimiter,
  validate(authValidation.login),
  asyncHandler(AuthController.login.bind(AuthController))
);

router.get(
  '/verify-email/:token',
  validate(authValidation.verifyEmail),
  asyncHandler(AuthController.verifyEmail.bind(AuthController))
);

router.post(
  '/resend-verification',
  emailLimiter,
  validate(authValidation.resendVerification),
  asyncHandler(AuthController.resendVerification.bind(AuthController))
);

router.post(
  '/forgot-password',
  emailLimiter,
  validate(authValidation.forgotPassword),
  asyncHandler(AuthController.forgotPassword.bind(AuthController))
);

router.post(
  '/reset-password/:token',
  validate(authValidation.resetPassword),
  asyncHandler(AuthController.resetPassword.bind(AuthController))
);

router.post(
  '/change-password',
  protect,
  validate(authValidation.changePassword),
  asyncHandler(AuthController.changePassword.bind(AuthController))
);

router.get(
  '/me',
  protect,
  asyncHandler(AuthController.getCurrentUser.bind(AuthController))
);

router.post(
  '/logout',
  protect,
  asyncHandler(AuthController.logout.bind(AuthController))
);

router.post(
  '/refresh-token',
  asyncHandler(AuthController.refreshToken.bind(AuthController))
);

export default router;
