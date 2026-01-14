import express from 'express';
import TaskController from '../controllers/taskController.js';
import rateLimit from 'express-rate-limit';
import { taskValidation } from '../validators/taskValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import {
  canAccessTask,
  canEditTask,
  canDeleteTask,
} from '../middlewares/taskPermissionMiddleware.js';
import upload from '../middlewares/upload.js';
import {
  cacheByUser,
  invalidateCache,
  cacheMiddleware,
} from '../middlewares/cacheMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';

const router = express.Router();

// Custom cache key generators for tasks
const taskCacheKey = (req) => {
  const userId = req.user._id;
  const query = JSON.stringify(req.query);
  return `user:${userId}:tasks:list:${query}`;
};

const taskSingleCacheKey = (req) => {
  const userId = req.user._id;
  const taskId = req.params.id;
  return `user:${userId}:tasks:single:${taskId}`;
};

// Rate limiter for task operations
const taskLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // 200 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many task requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for image upload
const imageUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // 50 image uploads per hour
  message: {
    success: false,
    message: 'Too many image uploads, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== ALL ROUTES REQUIRE AUTHENTICATION ==========
router.use(protect);
router.use(timezoneMiddleware);

// ========== TASK STATISTICS ==========
// Get task stats (must come before /:id route)
router.get(
  '/stats/me',
  taskLimiter,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(TaskController.getTaskStats.bind(TaskController))
);

// ========== DROPDOWN OPTIONS ==========
// Get dropdown options (categories, statuses, priorities)
router.get(
  '/dropdown-options',
  taskLimiter,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(TaskController.getDropdownOptions.bind(TaskController))
);

// ========== CREATE TASK ==========
router.post(
  '/',
  taskLimiter,
  upload.single('image'),
  validate(taskValidation.createTask),
  invalidateCache((req) => `user:${req.user._id}:tasks:*`),
  asyncHandler(TaskController.createTask.bind(TaskController))
);

// ========== GET ALL TASKS ==========
router.get(
  '/',
  taskLimiter,
  validate(taskValidation.getAllTasks),
  // Use custom cache key for list
  cacheMiddleware({
    ttl: 60, // 1 minute (tasks change frequently)
    keyGenerator: taskCacheKey,
  }),
  asyncHandler(TaskController.getAllTasks.bind(TaskController))
);

// ========== GET SINGLE TASK ==========
router.get(
  '/:id',
  taskLimiter,
  canAccessTask,
  validate(taskValidation.getTask),
  // Use custom cache key for single item
  cacheMiddleware({
    ttl: 300, // 5 minutes
    keyGenerator: taskSingleCacheKey,
  }),
  asyncHandler(TaskController.getTaskById.bind(TaskController))
);

// ========== UPDATE TASK ==========
router.patch(
  '/:id',
  taskLimiter,
  canEditTask,
  upload.single('image'),
  validate(taskValidation.updateTask),
  invalidateCache((req) => `user:${req.user._id}:tasks:*`),
  asyncHandler(TaskController.updateTask.bind(TaskController))
);

// ========== DELETE TASK ==========
router.delete(
  '/:id',
  taskLimiter,
  canDeleteTask,
  validate(taskValidation.deleteTask),
  invalidateCache((req) => `user:${req.user._id}:tasks:*`),
  asyncHandler(TaskController.deleteTask.bind(TaskController))
);

// ========== TOGGLE TASK COMPLETION ==========
router.post(
  '/:id/toggle-complete',
  taskLimiter,
  canEditTask,
  validate(taskValidation.toggleComplete),
  invalidateCache((req) => `user:${req.user._id}:tasks:*`),
  asyncHandler(TaskController.toggleComplete.bind(TaskController))
);

// ========== UPLOAD TASK IMAGE REMOVED (Merged into create/update) ==========

// ========== DELETE TASK IMAGE ==========
router.delete(
  '/:id/image',
  taskLimiter,
  canEditTask,
  validate(taskValidation.deleteTaskImage),
  invalidateCache((req) => `user:${req.user._id}:tasks:*`),
  asyncHandler(TaskController.deleteTaskImage.bind(TaskController))
);

// ========== RESTORE TASK (OPTIONAL) ==========
router.post(
  '/:id/restore',
  taskLimiter,
  canAccessTask,
  validate(taskValidation.getTask),
  invalidateCache((req) => `user:${req.user._id}:tasks:*`),
  asyncHandler(TaskController.restoreTask.bind(TaskController))
);

// ========== CONVERT TO VITAL TASK ==========
router.post(
  '/:id/convert-to-vital',
  taskLimiter,
  canDeleteTask,
  validate(taskValidation.getTask),
  invalidateCache((req) => `user:${req.user._id}:tasks:*`),
  asyncHandler(TaskController.convertToVitalTask.bind(TaskController))
);

// ========== REQUEST REVIEW ==========
router.post(
  '/:id/review',
  taskLimiter,
  canAccessTask, 
  validate(taskValidation.getTask), // Reusing getTask validation as it just checks params.id
  invalidateCache((req) => `user:${req.user._id}:tasks:*`),
  asyncHandler(TaskController.requestReview.bind(TaskController))
);

export default router;