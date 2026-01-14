import express from 'express';
import CategoryController from '../controllers/categoryController.js';
import { categoryValidation } from '../validators/categoryValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import {
  cacheByUser,
  invalidateCache,
  cacheMiddleware,
} from '../middlewares/cacheMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Custom cache key generators for categories
const categoryCacheKey = (req) => {
  const userId = req.user._id;
  const query = JSON.stringify(req.query);
  return `user:${userId}:categories:list:${query}`;
};

const categorySingleCacheKey = (req) => {
  const userId = req.user._id;
  const categoryId = req.params.id;
  return `user:${userId}:categories:single:${categoryId}`;
};

// Rate limiter for category operations
const categoryLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // 10000 requests per 5 minutes
  message: {
    success: false,
    message: 'Too many category requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== ALL ROUTES REQUIRE AUTHENTICATION ==========
router.use(protect);
router.use(timezoneMiddleware);

// ========== CATEGORY STATISTICS ==========
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
  // Invalidate all category caches for this user
  invalidateCache((req) => `user:${req.user._id}:categories:*`),
  asyncHandler(CategoryController.createCategory.bind(CategoryController))
);

// ========== GET ALL CATEGORIES ==========
router.get(
  '/',
  categoryLimiter,
  // Use custom cache key for list
  cacheMiddleware({
    ttl: 300, // 5 minutes
    keyGenerator: categoryCacheKey,
  }),
  asyncHandler(CategoryController.getAllCategories.bind(CategoryController))
);

// ========== GET SINGLE CATEGORY ==========
router.get(
  '/:id',
  categoryLimiter,
  validate(categoryValidation.getCategory),
  // Use custom cache key for single item
  cacheMiddleware({
    ttl: 300,
    keyGenerator: categorySingleCacheKey,
  }),
  asyncHandler(CategoryController.getCategoryById.bind(CategoryController))
);

// ========== UPDATE CATEGORY ==========
router.patch(
  '/:id',
  categoryLimiter,
  validate(categoryValidation.updateCategory),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:categories:*`),
  asyncHandler(CategoryController.updateCategory.bind(CategoryController))
);

// ========== DELETE CATEGORY ==========
router.delete(
  '/:id',
  categoryLimiter,
  validate(categoryValidation.deleteCategory),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:categories:*`),
  asyncHandler(CategoryController.deleteCategory.bind(CategoryController))
);

// ========== RESTORE CATEGORY (OPTIONAL) ==========
router.post(
  '/:id/restore',
  categoryLimiter,
  validate(categoryValidation.getCategory),
  // Invalidate all caches for this user
  invalidateCache((req) => `user:${req.user._id}:categories:*`),
  asyncHandler(CategoryController.restoreCategory.bind(CategoryController))
);

export default router;