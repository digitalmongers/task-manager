import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import cacheService from '../services/cacheService.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../middlewares/asyncHandler.js';

const router = express.Router();

/**
 * @route   DELETE /api/admin/cache/clear
 * @desc    Clear all cache (admin only)
 * @access  Private/Admin
 */
router.delete(
  '/cache/clear',
  protect,
  asyncHandler(async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return ApiResponse.error(res, 403, 'Access denied. Admin only.');
    }

    // Clear all cache
    const result = await cacheService.flush();

    return ApiResponse.success(res, 200, 'Cache cleared successfully', {
      result,
    });
  })
);

/**
 * @route   DELETE /api/admin/cache/user/:userId
 * @desc    Clear cache for specific user
 * @access  Private (Own cache or admin)
 */
router.delete(
  '/cache/user/:userId',
  protect,
  asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id.toString();

    // Allow users to clear their own cache or admin to clear any cache
    if (targetUserId !== currentUserId && req.user.role !== 'admin') {
      return ApiResponse.error(res, 403, 'Access denied');
    }

    // Clear user-specific cache
    const pattern = `user:${targetUserId}:*`;
    const deleted = await cacheService.deletePattern(pattern);

    return ApiResponse.success(res, 200, 'User cache cleared successfully', {
      deletedKeys: deleted,
      pattern,
    });
  })
);

/**
 * @route   GET /api/admin/cache/stats
 * @desc    Get cache statistics
 * @access  Private
 */
router.get(
  '/cache/stats',
  protect,
  asyncHandler(async (req, res) => {
    const stats = await cacheService.getStats();

    return ApiResponse.success(res, 200, 'Cache stats fetched successfully', {
      stats,
    });
  })
);

export default router;
