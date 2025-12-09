import express from 'express';
import TaskPriorityController from '../controllers/taskPriorityController.js';
import { taskPriorityValidation } from '../validators/taskPriorityValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import {
  cacheByUser,
  invalidateCache,
} from '../middlewares/cacheMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for task priority operations
const taskPriorityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many task priority requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== ALL ROUTES REQUIRE AUTHENTICATION ==========
// Apply protect middleware to all routes
router.use(protect);

// ========== TASK PRIORITY STATISTICS ==========
// Get task priority stats (must come before /:id route)
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
  invalidateCache((req) => `user:${req.user._id}:task-priorities:*`),
  asyncHandler(TaskPriorityController.createTaskPriority.bind(TaskPriorityController))
);

// ========== GET ALL TASK PRIORITIES ==========
router.get(
  '/',
  taskPriorityLimiter,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(TaskPriorityController.getAllTaskPriorities.bind(TaskPriorityController))
);

// ========== GET SINGLE TASK PRIORITY ==========
router.get(
  '/:id',
  taskPriorityLimiter,
  validate(taskPriorityValidation.getTaskPriority),
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(TaskPriorityController.getTaskPriorityById.bind(TaskPriorityController))
);

// ========== UPDATE TASK PRIORITY ==========
router.patch(
  '/:id',
  taskPriorityLimiter,
  validate(taskPriorityValidation.updateTaskPriority),
  invalidateCache((req) => `user:${req.user._id}:task-priorities:*`),
  asyncHandler(TaskPriorityController.updateTaskPriority.bind(TaskPriorityController))
);

// ========== DELETE TASK PRIORITY ==========
router.delete(
  '/:id',
  taskPriorityLimiter,
  validate(taskPriorityValidation.deleteTaskPriority),
  invalidateCache((req) => `user:${req.user._id}:task-priorities:*`),
  asyncHandler(TaskPriorityController.deleteTaskPriority.bind(TaskPriorityController))
);

// ========== RESTORE TASK PRIORITY (OPTIONAL) ==========
router.post(
  '/:id/restore',
  taskPriorityLimiter,
  validate(taskPriorityValidation.getTaskPriority),
  invalidateCache((req) => `user:${req.user._id}:task-priorities:*`),
  asyncHandler(TaskPriorityController.restoreTaskPriority.bind(TaskPriorityController))
);

export default router;