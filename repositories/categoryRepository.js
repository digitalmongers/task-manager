import Category from '../models/Category.js';
import Logger from '../config/logger.js';

class CategoryRepository {
  /**
   * Create new category
   */
  async createCategory(categoryData, userId) {
    try {
      const category = await Category.create({
        ...categoryData,
        user: userId,
      });

      Logger.info('Category created successfully', {
        categoryId: category._id,
        userId,
        title: category.title,
      });

      return category;
    } catch (error) {
      // Duplicate category title error
      if (error.code === 11000) {
        Logger.warn('Duplicate category title', { userId, title: categoryData.title });
        throw new Error('A category with this title already exists');
      }

      Logger.error('Error creating category', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find all categories for a user
   */
  async findByUser(userId, options = {}) {
    try {
      const {
        sort = '-createdAt',
        includeTaskCount = false,
      } = options;

      let query = Category.find({ user: userId });

      // Sorting
      query = query.sort(sort);

      // Include task count if needed
      if (includeTaskCount) {
        query = query.populate('taskCount');
      }

      const categories = await query;

      Logger.info('Categories fetched successfully', {
        userId,
        count: categories.length,
      });

      return categories;
    } catch (error) {
      Logger.error('Error fetching user categories', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find category by ID (with user verification)
   */
  async findByIdAndUser(categoryId, userId) {
    try {
      const category = await Category.findOne({
        _id: categoryId,
        user: userId,
      });

      if (!category) {
        Logger.warn('Category not found or unauthorized', {
          categoryId,
          userId,
        });
        return null;
      }

      return category;
    } catch (error) {
      Logger.error('Error finding category', {
        error: error.message,
        categoryId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, userId, updateData) {
    try {
      const category = await Category.findOneAndUpdate(
        { _id: categoryId, user: userId },
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!category) {
        Logger.warn('Category not found for update', {
          categoryId,
          userId,
        });
        return null;
      }

      Logger.info('Category updated successfully', {
        categoryId: category._id,
        userId,
        updatedFields: Object.keys(updateData),
      });

      return category;
    } catch (error) {
      // Duplicate title error
      if (error.code === 11000) {
        Logger.warn('Duplicate category title on update', {
          userId,
          categoryId,
        });
        throw new Error('A category with this title already exists');
      }

      Logger.error('Error updating category', {
        error: error.message,
        categoryId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete category (soft delete)
   */
  async deleteCategory(categoryId, userId) {
    try {
      const category = await Category.findOne({
        _id: categoryId,
        user: userId,
      });

      if (!category) {
        Logger.warn('Category not found for deletion', {
          categoryId,
          userId,
        });
        return null;
      }

      // Soft delete
      await category.softDelete();

      Logger.info('Category deleted successfully', {
        categoryId: category._id,
        userId,
        title: category.title,
      });

      return category;
    } catch (error) {
      Logger.error('Error deleting category', {
        error: error.message,
        categoryId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if category title exists for user
   */
  async titleExists(userId, title, excludeId = null) {
    try {
      const query = {
        user: userId,
        title: { $regex: new RegExp(`^${title}$`, 'i') }, // Case-insensitive
      };

      // Exclude current category when updating
      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const count = await Category.countDocuments(query);
      return count > 0;
    } catch (error) {
      Logger.error('Error checking category title existence', {
        error: error.message,
        userId,
        title,
      });
      throw error;
    }
  }

  /**
   * Get category statistics for user
   */
  async getUserCategoryStats(userId) {
    try {
      const stats = await Category.aggregate([
        {
          $match: {
            user: userId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalCategories: { $sum: 1 },
            categoriesWithDescription: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$description', null] }, { $ne: ['$description', ''] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      return stats[0] || {
        totalCategories: 0,
        categoriesWithDescription: 0,
      };
    } catch (error) {
      Logger.error('Error getting category stats', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore soft deleted category
   */
  async restoreCategory(categoryId, userId) {
    try {
      const category = await Category.findOne({
        _id: categoryId,
        user: userId,
      }).select('+isDeleted +deletedAt');

      if (!category) {
        return null;
      }

      if (!category.isDeleted) {
        throw new Error('Category is not deleted');
      }

      await category.restore();

      Logger.info('Category restored successfully', {
        categoryId: category._id,
        userId,
      });

      return category;
    } catch (error) {
      Logger.error('Error restoring category', {
        error: error.message,
        categoryId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Permanent delete (admin feature or cleanup)
   */
  async permanentDelete(categoryId, userId) {
    try {
      const category = await Category.findOneAndDelete({
        _id: categoryId,
        user: userId,
      });

      if (!category) {
        return null;
      }

      Logger.info('Category permanently deleted', {
        categoryId,
        userId,
        title: category.title,
      });

      return category;
    } catch (error) {
      Logger.error('Error permanently deleting category', {
        error: error.message,
        categoryId,
        userId,
      });
      throw error;
    }
  }
}

export default new CategoryRepository();