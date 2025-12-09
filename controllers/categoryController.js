import CategoryService from '../services/categoryService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

class CategoryController {
  /**
   * Create new category
   * POST /api/categories
   */
  async createCategory(req, res) {
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

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Categories fetched successfully',
      {
        categories: result.categories,
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

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Category fetched successfully',
      {
        category: result.category,
      }
    );
  }

  /**
   * Update category
   * PATCH /api/categories/:id
   */
  async updateCategory(req, res) {
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