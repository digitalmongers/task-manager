import express from 'express';
import VitalTaskController from '../controllers/vitalTaskController.js';
import { protect } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validate.js';
import upload from '../middlewares/upload.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  cacheMiddleware,
  invalidateCache,
} from '../middlewares/cacheMiddleware.js';
import {
  createVitalTaskSchema,
  updateVitalTaskSchema,
} from '../validators/vitalTask.validation.js';

const router = express.Router();

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

/**
 * @route   GET /api/vital-tasks/stats/me
 * @desc    Get vital task statistics
 * @access  Private
 */
router.get(
  '/stats/me',
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
  validate(createVitalTaskSchema),
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
  validate(updateVitalTaskSchema),
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
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.toggleComplete)
);

/**
 * @route   POST /api/vital-tasks/:id/image
 * @desc    Upload vital task image
 * @access  Private
 */
router.post(
  '/:id/image',
  upload.single('image'),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.uploadVitalTaskImage)
);

/**
 * @route   DELETE /api/vital-tasks/:id/image
 * @desc    Delete vital task image
 * @access  Private
 */
router.delete(
  '/:id/image',
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
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:vital-tasks:*`),
  asyncHandler(VitalTaskController.convertToRegularTask)
);

export default router;