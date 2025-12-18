import express from 'express';
import NotificationController from '../controllers/notificationController.js';
import { protect } from '../middlewares/authMiddleware.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter
const notificationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get(
  '/',
  notificationLimiter,
  asyncHandler(NotificationController.getNotifications.bind(NotificationController))
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notifications count
 * @access  Private
 */
router.get(
  '/unread-count',
  notificationLimiter,
  asyncHandler(NotificationController.getUnreadCount.bind(NotificationController))
);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch(
  '/read-all',
  notificationLimiter,
  asyncHandler(NotificationController.markAllAsRead.bind(NotificationController))
);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch(
  '/:id/read',
  notificationLimiter,
  asyncHandler(NotificationController.markAsRead.bind(NotificationController))
);

/**
 * @route   DELETE /api/notifications/all
 * @desc    Delete all notifications
 * @access  Private
 */
router.delete(
  '/all',
  notificationLimiter,
  asyncHandler(NotificationController.deleteAllNotifications.bind(NotificationController))
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete(
  '/:id',
  notificationLimiter,
  asyncHandler(NotificationController.deleteNotification.bind(NotificationController))
);

export default router;
