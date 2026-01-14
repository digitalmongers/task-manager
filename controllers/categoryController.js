import CategoryService from '../services/categoryService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { formatToLocal } from '../utils/dateUtils.js';
import { HTTP_STATUS } from '../config/constants.js';
import AIService from '../services/ai/aiService.js';
import ApiError from '../utils/ApiError.js';

class CategoryController {
  /**
   * Create new category
   * POST /api/categories
   * POST /api/categories?suggestions=true (for AI suggestions)
   */
  async createCategory(req, res) {
    // Check if AI suggestions requested
    if (req.query.suggestions === 'true') {
      if (!AIService.isEnabled()) {
        throw ApiError.serviceUnavailable('AI service is not configured');
      }

      const suggestions = await AIService.generateCategorySuggestions({
        ...req.body,
        userId: req.user._id,
      });

      if (suggestions && suggestions.error) {
        throw ApiError.serviceUnavailable(suggestions.error);
      }

      return ApiResponse.success(res, HTTP_STATUS.OK, 'AI suggestions generated', {
        suggestions,
      });
    }

    // Normal category creation
    const result = await CategoryService.createCategory(
      req.user._id,
      req.body
    );

    return ApiResponse.created(res, result.message, {
      category: result.category,
    });
  }

  /**
   * Get all categories for logged-in user
   * GET /api/categories
   */
  async getAllCategories(req, res) {
    const options = {
      sort: req.query.sort || '-createdAt',
      includeTaskCount: req.query.includeTaskCount === 'true',
    };

    const result = await CategoryService.getAllCategories(
      req.user._id,
      options
    );

    // Localize timestamps
    const localizedCategories = result.categories.map(cat => {
      const c = cat.toObject ? cat.toObject() : cat;
      return {
        ...c,
        createdAtLocal: formatToLocal(cat.createdAt, req.timezone),
        updatedAtLocal: formatToLocal(cat.updatedAt, req.timezone),
      };
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Categories fetched successfully',
      {
        categories: localizedCategories,
        count: result.count,
      }
    );
  }

  /**
   * Get single category by ID
   * GET /api/categories/:id
   */
  async getCategoryById(req, res) {
    const result = await CategoryService.getCategoryById(
      req.user._id,
      req.params.id
    );

    // Localize timestamps
    const c = result.category.toObject ? result.category.toObject() : result.category;
    const localizedCategory = {
      ...c,
      createdAtLocal: formatToLocal(result.category.createdAt, req.timezone),
      updatedAtLocal: formatToLocal(result.category.updatedAt, req.timezone),
    };

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Category fetched successfully',
      {
        category: localizedCategory,
      }
    );
  }

  /**
   * Update category
   * PATCH /api/categories/:id
   * PATCH /api/categories/:id?suggestions=true (for AI suggestions)
   */
  async updateCategory(req, res) {
    // Check if AI suggestions requested
    if (req.query.suggestions === 'true') {
      if (!AIService.isEnabled()) {
        throw ApiError.serviceUnavailable('AI service is not configured');
      }

      const suggestions = await AIService.generateCategorySuggestions({
        ...req.body,
        userId: req.user._id,
        isUpdate: true,
      });

      if (suggestions && suggestions.error) {
        throw ApiError.serviceUnavailable(suggestions.error);
      }

      return ApiResponse.success(res, HTTP_STATUS.OK, 'AI suggestions generated', {
        suggestions,
      });
    }

    // Normal category update
    const result = await CategoryService.updateCategory(
      req.user._id,
      req.params.id,
      req.body
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      category: result.category,
    });
  }

  /**
   * Delete category
   * DELETE /api/categories/:id
   */
  async deleteCategory(req, res) {
    const result = await CategoryService.deleteCategory(
      req.user._id,
      req.params.id
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message);
  }

  /**
   * Get category statistics
   * GET /api/categories/stats/me
   */
  async getCategoryStats(req, res) {
    const result = await CategoryService.getCategoryStats(req.user._id);

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Category statistics fetched successfully',
      result.stats
    );
  }

  /**
   * Restore deleted category (optional)
   * POST /api/categories/:id/restore
   */
  async restoreCategory(req, res) {
    const result = await CategoryService.restoreCategory(
      req.user._id,
      req.params.id
    );

    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {
      category: result.category,
    });
  }
}

export default new CategoryController();