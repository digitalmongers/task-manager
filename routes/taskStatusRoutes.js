import express from 'express';
import TaskStatusController from '../controllers/taskStatusController.js';
import { taskStatusValidation } from '../validators/taskStatusValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import {
  cacheByUser,
  invalidateCache,
} from '../middlewares/cacheMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for task status operations
const taskStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many task status requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== ALL ROUTES REQUIRE AUTHENTICATION ==========
// Apply protect middleware to all routes
router.use(protect);

// ========== TASK STATUS STATISTICS ==========
// Get task status stats (must come before /:id route)
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
  invalidateCache((req) => `user:${req.user._id}:task-statuses:*`),
  asyncHandler(TaskStatusController.createTaskStatus.bind(TaskStatusController))
);

// ========== GET ALL TASK STATUSES ==========
router.get(
  '/',
  taskStatusLimiter,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(TaskStatusController.getAllTaskStatuses.bind(TaskStatusController))
);

// ========== GET SINGLE TASK STATUS ==========
router.get(
  '/:id',
  taskStatusLimiter,
  validate(taskStatusValidation.getTaskStatus),
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(TaskStatusController.getTaskStatusById.bind(TaskStatusController))
);

// ========== UPDATE TASK STATUS ==========
router.patch(
  '/:id',
  taskStatusLimiter,
  validate(taskStatusValidation.updateTaskStatus),
  invalidateCache((req) => `user:${req.user._id}:task-statuses:*`),
  asyncHandler(TaskStatusController.updateTaskStatus.bind(TaskStatusController))
);

// ========== DELETE TASK STATUS ==========
router.delete(
  '/:id',
  taskStatusLimiter,
  validate(taskStatusValidation.deleteTaskStatus),
  invalidateCache((req) => `user:${req.user._id}:task-statuses:*`),
  asyncHandler(TaskStatusController.deleteTaskStatus.bind(TaskStatusController))
);

// ========== RESTORE TASK STATUS (OPTIONAL) ==========
router.post(
  '/:id/restore',
  taskStatusLimiter,
  validate(taskStatusValidation.getTaskStatus),
  invalidateCache((req) => `user:${req.user._id}:task-statuses:*`),
  asyncHandler(TaskStatusController.restoreTaskStatus.bind(TaskStatusController))
);

export default router;