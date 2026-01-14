import express from 'express';
import TaskStatusController from '../controllers/taskStatusController.js';
import { taskStatusValidation } from '../validators/taskStatusValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import {
  cacheByUser,
  invalidateCache,
  cacheMiddleware,
} from '../middlewares/cacheMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Custom cache key generator for task statuses
const taskStatusCacheKey = (req) => {
  const userId = req.user._id;
  const query = JSON.stringify(req.query);
  return `user:${userId}:task-statuses:list:${query}`;
};

const taskStatusSingleCacheKey = (req) => {
  const userId = req.user._id;
  const statusId = req.params.id;
  return `user:${userId}:task-statuses:single:${statusId}`;
};

// Rate limiter for task status operations
const taskStatusLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // 10000 requests per 5 minutes
  message: {
    success: false,
    message: 'Too many task status requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== ALL ROUTES REQUIRE AUTHENTICATION ==========
router.use(protect);
router.use(timezoneMiddleware);

// ========== TASK STATUS STATISTICS ==========
router.get(
  '/stats/me',
  taskStatusLimiter,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(TaskStatusController.getTaskStatusStats.bind(TaskStatusController))
);

// ========== CREATE TASK STATUS ==========
router.post(
  '/',
  taskStatusLimiter,
  validate(taskStatusValidation.createTaskStatus),
  // Invalidate all task status caches for this user
  invalidateCache((req) => `user:${req.user._id}:task-statuses:*`),
  asyncHandler(TaskStatusController.createTaskStatus.bind(TaskStatusController))
);

// ========== GET ALL TASK STATUSES ==========
router.get(
  '/',
  taskStatusLimiter,
  // Use custom cache key for list
  cacheMiddleware({
    ttl: 300, // 5 minutes
    keyGenerator: taskStatusCacheKey,
  }),
  asyncHandler(TaskStatusController.getAllTaskStatuses.bind(TaskStatusController))
);

// ========== GET SINGLE TASK STATUS ==========
router.get(
  '/:id',
  taskStatusLimiter,
  validate(taskStatusValidation.getTaskStatus),
  // Use custom cache key for single item
  cacheMiddleware({
    ttl: 300,
    keyGenerator: taskStatusSingleCacheKey,
  }),
  asyncHandler(TaskStatusController.getTaskStatusById.bind(TaskStatusController))
);

// ========== UPDATE TASK STATUS ==========
router.patch(
  '/:id',
  taskStatusLimiter,
  validate(taskStatusValidation.updateTaskStatus),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:task-statuses:*`),
  asyncHandler(TaskStatusController.updateTaskStatus.bind(TaskStatusController))
);

// ========== DELETE TASK STATUS ==========
router.delete(
  '/:id',
  taskStatusLimiter,
  validate(taskStatusValidation.deleteTaskStatus),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:task-statuses:*`),
  asyncHandler(TaskStatusController.deleteTaskStatus.bind(TaskStatusController))
);

// ========== RESTORE TASK STATUS (OPTIONAL) ==========
router.post(
  '/:id/restore',
  taskStatusLimiter,
  validate(taskStatusValidation.getTaskStatus),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:task-statuses:*`),
  asyncHandler(TaskStatusController.restoreTaskStatus.bind(TaskStatusController))
);

export default router;