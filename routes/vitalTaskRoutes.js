import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import VitalTaskController from '../controllers/vitalTaskController.js';
import upload from '../middlewares/upload.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  cacheMiddleware,
  invalidateCache,
} from '../middlewares/cacheMiddleware.js';
import {
  vitalTaskValidation,
} from '../validators/vitalTask.validation.js';
import { 
  canAccessVitalTask, 
  canEditVitalTask, 
  canDeleteVitalTask 
} from '../middlewares/vitalTaskPermissionMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for vital task operations
const vitalTaskLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // 10000 requests per 5 minutes
  message: {
    success: false,
    message: 'Too many vital task requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom cache key generators for vital tasks
const vitalTaskCacheKey = (req) => {
  const userId = req.user._id;
  const query = JSON.stringify(req.query);
  return `user:${userId}:vital-tasks:list:${query}`;
};

const vitalTaskSingleCacheKey = (req) => {
  const userId = req.user._id;
  const taskId = req.params.id;
  return `user:${userId}:vital-tasks:single:${taskId}`;
};

// All routes require authentication
router.use(protect);
router.use(timezoneMiddleware);

/**
 * @route   GET /api/vital-tasks/stats/me
 * @desc    Get vital task statistics
 * @access  Private
 */
router.get(
  '/stats/me',
  vitalTaskLimiter,
  cacheMiddleware({
    ttl: 300, // 5 minutes
    keyGenerator: (req) => `user:${req.user._id}:vital-tasks:stats`,
  }),
  asyncHandler(VitalTaskController.getVitalTaskStats)
);

/**
 * @route   POST /api/vital-tasks
 * @desc    Create new vital task
 * @access  Private
 */
router.post(
  '/',
  vitalTaskLimiter,
  upload.single('image'),
  validate(vitalTaskValidation.createVitalTask),
  // Invalidate all vital task caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.createVitalTask)
);

/**
 * @route   GET /api/vital-tasks
 * @desc    Get all vital tasks for user
 * @access  Private
 */
router.get(
  '/',
  vitalTaskLimiter,
  // Use custom cache key for list
  cacheMiddleware({
    ttl: 60, // 1 minute (tasks change frequently)
    keyGenerator: vitalTaskCacheKey,
  }),
  asyncHandler(VitalTaskController.getAllVitalTasks)
);

/**
 * @route   GET /api/vital-tasks/:id
 * @desc    Get single vital task
 * @access  Private
 */
router.get(
  '/:id',
  vitalTaskLimiter,
  canAccessVitalTask,
  // Use custom cache key for single item
  cacheMiddleware({
    ttl: 300, // 5 minutes
    keyGenerator: vitalTaskSingleCacheKey,
  }),
  asyncHandler(VitalTaskController.getVitalTaskById)
);

/**
 * @route   PATCH /api/vital-tasks/:id
 * @desc    Update vital task
 * @access  Private
 */
router.patch(
  '/:id',
  vitalTaskLimiter,
  canEditVitalTask,
  upload.single('image'),
  validate(vitalTaskValidation.updateVitalTask),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.updateVitalTask)
);

/**
 * @route   DELETE /api/vital-tasks/:id
 * @desc    Delete vital task
 * @access  Private
 */
router.delete(
  '/:id',
  vitalTaskLimiter,
  canDeleteVitalTask,
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.deleteVitalTask)
);

/**
 * @route   POST /api/vital-tasks/:id/toggle-complete
 * @desc    Toggle vital task completion
 * @access  Private
 */
router.post(
  '/:id/toggle-complete',
  vitalTaskLimiter,
  canEditVitalTask,
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.toggleComplete)
);

/**
 * @route   POST /api/vital-tasks/:id/image
 * @desc    Upload vital task image - REMOVED (Merged into create/update)
 */

/**
 * @route   DELETE /api/vital-tasks/:id/image
 * @desc    Delete vital task image
 * @access  Private
 */
router.delete(
  '/:id/image',
  vitalTaskLimiter,
  canEditVitalTask,
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.deleteVitalTaskImage)
);

/**
 * @route   POST /api/vital-tasks/:id/restore
 * @desc    Restore deleted vital task
 * @access  Private
 */
router.post(
  '/:id/restore',
  vitalTaskLimiter,
  canAccessVitalTask,
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.restoreVitalTask)
);

/**
 * @route   POST /api/vital-tasks/:id/convert-to-regular
 * @desc    Convert vital task to regular task
 * @access  Private
 */
router.post(
  '/:id/convert-to-regular',
  vitalTaskLimiter,
  canDeleteVitalTask,
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.convertToRegularTask)
);


/**
 * @route   POST /api/vital-tasks/:id/review
 * @desc    Request review for vital task
 * @access  Private
 */
router.post(
  '/:id/review',
  vitalTaskLimiter,
  canAccessVitalTask,
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.requestReview)
);

export default router;