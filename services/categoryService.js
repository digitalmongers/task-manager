import CategoryRepository from '../repositories/categoryRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

class CategoryService {
  /**
   * Create new category
   */
  async createCategory(userId, categoryData) {
    try {
      const { title, description, color } = categoryData;

      // Check if category with same title already exists for this user
      const titleExists = await CategoryRepository.titleExists(userId, title);
      if (titleExists) {
        throw ApiError.conflict('A category with this title already exists');
      }

      // Create category
      const category = await CategoryRepository.createCategory(
        {
          title,
          description: description || null,
          color: color || '#3B82F6',
        },
        userId
      );

      Logger.logAuth('CATEGORY_CREATED', userId, {
        categoryId: category._id,
        title: category.title,
      });

      return {
        category,
        message: 'Category created successfully',
      };
    } catch (error) {
      Logger.error('Error in createCategory service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all categories for user
   */
  async getAllCategories(userId, options = {}) {
    try {
      const categories = await CategoryRepository.findByUser(userId, options);

      return {
        categories,
        count: categories.length,
      };
    } catch (error) {
      Logger.error('Error in getAllCategories service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get single category by ID
   */
  async getCategoryById(userId, categoryId) {
    try {
      const category = await CategoryRepository.findByIdAndUser(
        categoryId,
        userId
      );

      if (!category) {
        throw ApiError.notFound('Category not found');
      }

      return { category };
    } catch (error) {
      Logger.error('Error in getCategoryById service', {
        error: error.message,
        userId,
        categoryId,
      });
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(userId, categoryId, updateData) {
    try {
      // Check if category exists and belongs to user
      const existingCategory = await CategoryRepository.findByIdAndUser(
        categoryId,
        userId
      );

      if (!existingCategory) {
        throw ApiError.notFound('Category not found');
      }

      // If title is being updated, check for duplicates
      if (updateData.title && updateData.title !== existingCategory.title) {
        const titleExists = await CategoryRepository.titleExists(
          userId,
          updateData.title,
          categoryId
        );

        if (titleExists) {
          throw ApiError.conflict('A category with this title already exists');
        }
      }

      // Update category
      const updatedCategory = await CategoryRepository.updateCategory(
        categoryId,
        userId,
        updateData
      );

      Logger.logAuth('CATEGORY_UPDATED', userId, {
        categoryId: updatedCategory._id,
        updatedFields: Object.keys(updateData),
      });

      return {
        category: updatedCategory,
        message: 'Category updated successfully',
      };
    } catch (error) {
      Logger.error('Error in updateCategory service', {
        error: error.message,
        userId,
        categoryId,
      });
      throw error;
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(userId, categoryId) {
    try {
      // Check if category exists and belongs to user
      const category = await CategoryRepository.findByIdAndUser(
        categoryId,
        userId
      );

      if (!category) {
        throw ApiError.notFound('Category not found');
      }

      // TODO: Optional - Check if category has tasks
      // If you want to prevent deletion of categories with tasks:
      // const taskCount = await TaskRepository.countByCategoryId(categoryId);
      // if (taskCount > 0) {
      //   throw ApiError.badRequest('Cannot delete category with existing tasks');
      // }

      // Soft delete category
      await CategoryRepository.deleteCategory(categoryId, userId);

      Logger.logAuth('CATEGORY_DELETED', userId, {
        categoryId,
        title: category.title,
      });

      return {
        message: 'Category deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteCategory service', {
        error: error.message,
        userId,
        categoryId,
      });
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(userId) {
    try {
      const stats = await CategoryRepository.getUserCategoryStats(userId);

      return { stats };
    } catch (error) {
      Logger.error('Error in getCategoryStats service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore deleted category (optional feature)
   */
  async restoreCategory(userId, categoryId) {
    try {
      const category = await CategoryRepository.restoreCategory(
        categoryId,
        userId
      );

      if (!category) {
        throw ApiError.notFound('Category not found');
      }

      Logger.logAuth('CATEGORY_RESTORED', userId, {
        categoryId,
      });

      return {
        category,
        message: 'Category restored successfully',
      };
    } catch (error) {
      Logger.error('Error in restoreCategory service', {
        error: error.message,
        userId,
        categoryId,
      });
      throw error;
    }
  }
}

export default new CategoryService();