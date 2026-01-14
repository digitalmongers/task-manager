import express from 'express';
import TaskPriorityController from '../controllers/taskPriorityController.js';
import { taskPriorityValidation } from '../validators/taskPriorityValidation.js';
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

// Custom cache key generators for task priorities
const taskPriorityCacheKey = (req) => {
  const userId = req.user._id;
  const query = JSON.stringify(req.query);
  return `user:${userId}:task-priorities:list:${query}`;
};

const taskPrioritySingleCacheKey = (req) => {
  const userId = req.user._id;
  const priorityId = req.params.id;
  return `user:${userId}:task-priorities:single:${priorityId}`;
};

// Rate limiter for task priority operations
const taskPriorityLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // 10000 requests per 5 minutes
  message: {
    success: false,
    message: 'Too many task priority requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== ALL ROUTES REQUIRE AUTHENTICATION ==========
router.use(protect);
router.use(timezoneMiddleware);

// ========== TASK PRIORITY STATISTICS ==========
router.get(
  '/stats/me',
  taskPriorityLimiter,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(TaskPriorityController.getTaskPriorityStats.bind(TaskPriorityController))
);

// ========== CREATE TASK PRIORITY ==========
router.post(
  '/',
  taskPriorityLimiter,
  validate(taskPriorityValidation.createTaskPriority),
  // Invalidate all task priority caches for this user
  invalidateCache((req) => `user:${req.user._id}:task-priorities:*`),
  asyncHandler(TaskPriorityController.createTaskPriority.bind(TaskPriorityController))
);

// ========== GET ALL TASK PRIORITIES ==========
router.get(
  '/',
  taskPriorityLimiter,
  // Use custom cache key for list
  cacheMiddleware({
    ttl: 300, // 5 minutes
    keyGenerator: taskPriorityCacheKey,
  }),
  asyncHandler(TaskPriorityController.getAllTaskPriorities.bind(TaskPriorityController))
);

// ========== GET SINGLE TASK PRIORITY ==========
router.get(
  '/:id',
  taskPriorityLimiter,
  validate(taskPriorityValidation.getTaskPriority),
  // Use custom cache key for single item
  cacheMiddleware({
    ttl: 300,
    keyGenerator: taskPrioritySingleCacheKey,
  }),
  asyncHandler(TaskPriorityController.getTaskPriorityById.bind(TaskPriorityController))
);

// ========== UPDATE TASK PRIORITY ==========
router.patch(
  '/:id',
  taskPriorityLimiter,
  validate(taskPriorityValidation.updateTaskPriority),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:task-priorities:*`),
  asyncHandler(TaskPriorityController.updateTaskPriority.bind(TaskPriorityController))
);

// ========== DELETE TASK PRIORITY ==========
router.delete(
  '/:id',
  taskPriorityLimiter,
  validate(taskPriorityValidation.deleteTaskPriority),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:task-priorities:*`),
  asyncHandler(TaskPriorityController.deleteTaskPriority.bind(TaskPriorityController))
);

// ========== RESTORE TASK PRIORITY (OPTIONAL) ==========
router.post(
  '/:id/restore',
  taskPriorityLimiter,
  validate(taskPriorityValidation.getTaskPriority),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:task-priorities:*`),
  asyncHandler(TaskPriorityController.restoreTaskPriority.bind(TaskPriorityController))
);

export default router;