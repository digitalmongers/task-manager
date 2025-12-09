import TaskPriority from '../models/TaskPriority.js';
import Logger from '../config/logger.js';

class TaskPriorityRepository {
  /**
   * Create new task priority
   */
  async createTaskPriority(priorityData, userId) {
    try {
      const priority = await TaskPriority.create({
        ...priorityData,
        user: userId,
      });

      Logger.info('Task priority created successfully', {
        priorityId: priority._id,
        userId,
        name: priority.name,
      });

      return priority;
    } catch (error) {
      // Duplicate priority name error
      if (error.code === 11000) {
        Logger.warn('Duplicate task priority name', { userId, name: priorityData.name });
        throw new Error('A priority with this name already exists');
      }

      Logger.error('Error creating task priority', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find all task priorities for a user
   */
  async findByUser(userId, options = {}) {
    try {
      const {
        sort = '-createdAt',
        includeTaskCount = false,
      } = options;

      let query = TaskPriority.find({ user: userId });

      // Sorting
      query = query.sort(sort);

      // Include task count if needed
      if (includeTaskCount) {
        query = query.populate('taskCount');
      }

      const priorities = await query;

      Logger.info('Task priorities fetched successfully', {
        userId,
        count: priorities.length,
      });

      return priorities;
    } catch (error) {
      Logger.error('Error fetching user task priorities', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find task priority by ID (with user verification)
   */
  async findByIdAndUser(priorityId, userId) {
    try {
      const priority = await TaskPriority.findOne({
        _id: priorityId,
        user: userId,
      });

      if (!priority) {
        Logger.warn('Task priority not found or unauthorized', {
          priorityId,
          userId,
        });
        return null;
      }

      return priority;
    } catch (error) {
      Logger.error('Error finding task priority', {
        error: error.message,
        priorityId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update task priority
   */
  async updateTaskPriority(priorityId, userId, updateData) {
    try {
      const priority = await TaskPriority.findOneAndUpdate(
        { _id: priorityId, user: userId },
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!priority) {
        Logger.warn('Task priority not found for update', {
          priorityId,
          userId,
        });
        return null;
      }

      Logger.info('Task priority updated successfully', {
        priorityId: priority._id,
        userId,
        updatedFields: Object.keys(updateData),
      });

      return priority;
    } catch (error) {
      // Duplicate name error
      if (error.code === 11000) {
        Logger.warn('Duplicate task priority name on update', {
          userId,
          priorityId,
        });
        throw new Error('A priority with this name already exists');
      }

      Logger.error('Error updating task priority', {
        error: error.message,
        priorityId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete task priority (soft delete)
   */
  async deleteTaskPriority(priorityId, userId) {
    try {
      const priority = await TaskPriority.findOne({
        _id: priorityId,
        user: userId,
      });

      if (!priority) {
        Logger.warn('Task priority not found for deletion', {
          priorityId,
          userId,
        });
        return null;
      }

      // Soft delete
      await priority.softDelete();

      Logger.info('Task priority deleted successfully', {
        priorityId: priority._id,
        userId,
        name: priority.name,
      });

      return priority;
    } catch (error) {
      Logger.error('Error deleting task priority', {
        error: error.message,
        priorityId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if priority name exists for user
   */
  async nameExists(userId, name, excludeId = null) {
    try {
      const query = {
        user: userId,
        name: { $regex: new RegExp(`^${name}$`, 'i') }, // Case-insensitive
        isDeleted: false, // Only check active priorities
      };

      // Exclude current priority when updating
      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const count = await TaskPriority.countDocuments(query);
      return count > 0;
    } catch (error) {
      Logger.error('Error checking task priority name existence', {
        error: error.message,
        userId,
        name,
      });
      throw error;
    }
  }

  /**
   * Get task priority statistics for user
   */
  async getUserPriorityStats(userId) {
    try {
      const stats = await TaskPriority.aggregate([
        {
          $match: {
            user: userId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalPriorities: { $sum: 1 },
            prioritiesWithDescription: {
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
        totalPriorities: 0,
        prioritiesWithDescription: 0,
      };
    } catch (error) {
      Logger.error('Error getting task priority stats', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore soft deleted task priority
   */
  async restoreTaskPriority(priorityId, userId) {
    try {
      const priority = await TaskPriority.findOne({
        _id: priorityId,
        user: userId,
      }).select('+isDeleted +deletedAt');

      if (!priority) {
        return null;
      }

      if (!priority.isDeleted) {
        throw new Error('Task priority is not deleted');
      }

      await priority.restore();

      Logger.info('Task priority restored successfully', {
        priorityId: priority._id,
        userId,
      });

      return priority;
    } catch (error) {
      Logger.error('Error restoring task priority', {
        error: error.message,
        priorityId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Permanent delete (admin feature or cleanup)
   */
  async permanentDelete(priorityId, userId) {
    try {
      const priority = await TaskPriority.findOneAndDelete({
        _id: priorityId,
        user: userId,
      });

      if (!priority) {
        return null;
      }

      Logger.info('Task priority permanently deleted', {
        priorityId,
        userId,
        name: priority.name,
      });

      return priority;
    } catch (error) {
      Logger.error('Error permanently deleting task priority', {
        error: error.message,
        priorityId,
        userId,
      });
      throw error;
    }
  }
}

export default new TaskPriorityRepository();