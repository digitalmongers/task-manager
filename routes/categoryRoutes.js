import express from 'express';
import CategoryController from '../controllers/categoryController.js';
import { categoryValidation } from '../validators/categoryValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import {
  cacheByUser,
  invalidateCache,
} from '../middlewares/cacheMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for category operations
const categoryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many category requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== ALL ROUTES REQUIRE AUTHENTICATION ==========
// Apply protect middleware to all routes
router.use(protect);

// ========== CATEGORY STATISTICS ==========
// Get category stats (must come before /:id route)
router.get(
  '/stats/me',
  categoryLimiter,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(CategoryController.getCategoryStats.bind(CategoryController))
);

// ========== CREATE CATEGORY ==========
router.post(
  '/',
  categoryLimiter,
  validate(categoryValidation.createCategory),
  invalidateCache((req) => `user:${req.user._id}:categories:*`),
  asyncHandler(CategoryController.createCategory.bind(CategoryController))
);

// ========== GET ALL CATEGORIES ==========
router.get(
  '/',
  categoryLimiter,
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(CategoryController.getAllCategories.bind(CategoryController))
);

// ========== GET SINGLE CATEGORY ==========
router.get(
  '/:id',
  categoryLimiter,
  validate(categoryValidation.getCategory),
  cacheByUser(300), // Cache for 5 minutes
  asyncHandler(CategoryController.getCategoryById.bind(CategoryController))
);

// ========== UPDATE CATEGORY ==========
router.patch(
  '/:id',
  categoryLimiter,
  validate(categoryValidation.updateCategory),
  invalidateCache((req) => `user:${req.user._id}:categories:*`),
  asyncHandler(CategoryController.updateCategory.bind(CategoryController))
);

// ========== DELETE CATEGORY ==========
router.delete(
  '/:id',
  categoryLimiter,
  validate(categoryValidation.deleteCategory),
  invalidateCache((req) => `user:${req.user._id}:categories:*`),
  asyncHandler(CategoryController.deleteCategory.bind(CategoryController))
);

// ========== RESTORE CATEGORY (OPTIONAL) ==========
router.post(
  '/:id/restore',
  categoryLimiter,
  validate(categoryValidation.getCategory),
  invalidateCache((req) => `user:${req.user._id}:categories:*`),
  asyncHandler(CategoryController.restoreCategory.bind(CategoryController))
);

export default router;