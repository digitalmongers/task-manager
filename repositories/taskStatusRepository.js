import TaskStatus from '../models/TaskStatus.js';
import Logger from '../config/logger.js';

class TaskStatusRepository {
  /**
   * Create new task status
   */
  async createTaskStatus(statusData, userId) {
    try {
      const status = await TaskStatus.create({
        ...statusData,
        user: userId,
      });

      Logger.info('Task status created successfully', {
        statusId: status._id,
        userId,
        name: status.name,
      });

      return status;
    } catch (error) {
      // Duplicate status name error
      if (error.code === 11000) {
        Logger.warn('Duplicate task status name', { userId, name: statusData.name });
        throw new Error('A status with this name already exists');
      }

      Logger.error('Error creating task status', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find all task statuses for a user
   */
  async findByUser(userId, options = {}) {
    try {
      const {
        sort = '-createdAt',
        includeTaskCount = false,
      } = options;

      let query = TaskStatus.find({ user: userId });

      // Sorting
      query = query.sort(sort);

      // Include task count if needed
      if (includeTaskCount) {
        query = query.populate('taskCount');
      }

      const statuses = await query;

      Logger.info('Task statuses fetched successfully', {
        userId,
        count: statuses.length,
      });

      return statuses;
    } catch (error) {
      Logger.error('Error fetching user task statuses', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find task status by ID (with user verification)
   */
  async findByIdAndUser(statusId, userId) {
    try {
      const status = await TaskStatus.findOne({
        _id: statusId,
        user: userId,
      });

      if (!status) {
        Logger.warn('Task status not found or unauthorized', {
          statusId,
          userId,
        });
        return null;
      }

      return status;
    } catch (error) {
      Logger.error('Error finding task status', {
        error: error.message,
        statusId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(statusId, userId, updateData) {
    try {
      const status = await TaskStatus.findOneAndUpdate(
        { _id: statusId, user: userId },
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!status) {
        Logger.warn('Task status not found for update', {
          statusId,
          userId,
        });
        return null;
      }

      Logger.info('Task status updated successfully', {
        statusId: status._id,
        userId,
        updatedFields: Object.keys(updateData),
      });

      return status;
    } catch (error) {
      // Duplicate name error
      if (error.code === 11000) {
        Logger.warn('Duplicate task status name on update', {
          userId,
          statusId,
        });
        throw new Error('A status with this name already exists');
      }

      Logger.error('Error updating task status', {
        error: error.message,
        statusId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete task status (soft delete)
   */
  async deleteTaskStatus(statusId, userId) {
    try {
      const status = await TaskStatus.findOne({
        _id: statusId,
        user: userId,
      });

      if (!status) {
        Logger.warn('Task status not found for deletion', {
          statusId,
          userId,
        });
        return null;
      }

      // Soft delete
      await status.softDelete();

      Logger.info('Task status deleted successfully', {
        statusId: status._id,
        userId,
        name: status.name,
      });

      return status;
    } catch (error) {
      Logger.error('Error deleting task status', {
        error: error.message,
        statusId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if status name exists for user
   */
  async nameExists(userId, name, excludeId = null) {
    try {
      const query = {
        user: userId,
        name: { $regex: new RegExp(`^${name}$`, 'i') }, // Case-insensitive
      };

      // Exclude current status when updating
      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const count = await TaskStatus.countDocuments(query);
      return count > 0;
    } catch (error) {
      Logger.error('Error checking task status name existence', {
        error: error.message,
        userId,
        name,
      });
      throw error;
    }
  }

  /**
   * Get task status statistics for user
   */
  async getUserStatusStats(userId) {
    try {
      const stats = await TaskStatus.aggregate([
        {
          $match: {
            user: userId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalStatuses: { $sum: 1 },
            statusesWithDescription: {
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
        totalStatuses: 0,
        statusesWithDescription: 0,
      };
    } catch (error) {
      Logger.error('Error getting task status stats', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore soft deleted task status
   */
  async restoreTaskStatus(statusId, userId) {
    try {
      const status = await TaskStatus.findOne({
        _id: statusId,
        user: userId,
      }).select('+isDeleted +deletedAt');

      if (!status) {
        return null;
      }

      if (!status.isDeleted) {
        throw new Error('Task status is not deleted');
      }

      await status.restore();

      Logger.info('Task status restored successfully', {
        statusId: status._id,
        userId,
      });

      return status;
    } catch (error) {
      Logger.error('Error restoring task status', {
        error: error.message,
        statusId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Permanent delete (admin feature or cleanup)
   */
  async permanentDelete(statusId, userId) {
    try {
      const status = await TaskStatus.findOneAndDelete({
        _id: statusId,
        user: userId,
      });

      if (!status) {
        return null;
      }

      Logger.info('Task status permanently deleted', {
        statusId,
        userId,
        name: status.name,
      });

      return status;
    } catch (error) {
      Logger.error('Error permanently deleting task status', {
        error: error.message,
        statusId,
        userId,
      });
      throw error;
    }
  }
}

export default new TaskStatusRepository();