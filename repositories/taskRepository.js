import Task from '../models/Task.js';
import Logger from '../config/logger.js';

class TaskRepository {
  /**
   * Create new task
   */
  async createTask(taskData, userId) {
    try {
      const task = await Task.create({
        ...taskData,
        user: userId,
      });

      await task.populate([
        { path: 'category', select: 'title color' },
        { path: 'status', select: 'name color' },
        { path: 'priority', select: 'name color' },
      ]);

      Logger.info('Task created successfully', {
        taskId: task._id,
        userId,
        title: task.title,
      });

      return task;
    } catch (error) {
      Logger.error('Error creating task', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find all tasks for a user with filters
   */
  async findByUser(userId, filters = {}, options = {}) {
    try {
      const {
        category,
        status,
        priority,
        isCompleted,
        sort = '-createdAt',
        page = 1,
        limit = 10,
      } = options;

      const query = { user: userId, isDeleted: false };

      if (category) query.category = category;
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (isCompleted !== undefined) {
        query.isCompleted = isCompleted === 'true' || isCompleted === true;
      }

      const skip = (page - 1) * limit;

      const tasks = await Task.find(query)
        .populate('category', 'title color')
        .populate('status', 'name color')
        .populate('priority', 'name color')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Task.countDocuments(query);

      Logger.info('Tasks fetched successfully', {
        userId,
        count: tasks.length,
        total,
        page,
      });

      return {
        tasks,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      Logger.error('Error fetching user tasks', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Find task by ID (with user verification)
   */
  async findByIdAndUser(taskId, userId) {
    try {
      const task = await Task.findOne({
        _id: taskId,
        user: userId,
      })
        .populate('category', 'title color')
        .populate('status', 'name color')
        .populate('priority', 'name color');

      if (!task) {
        Logger.warn('Task not found or unauthorized', {
          taskId,
          userId,
        });
        return null;
      }

      return task;
    } catch (error) {
      Logger.error('Error finding task', {
        error: error.message,
        taskId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update task
   */
  async updateTask(taskId, userId, updateData) {
    try {
      const task = await Task.findOneAndUpdate(
        { _id: taskId, user: userId },
        updateData,
        {
          new: true,
          runValidators: true,
        }
      )
        .populate('category', 'title color')
        .populate('status', 'name color')
        .populate('priority', 'name color');

      if (!task) {
        Logger.warn('Task not found for update', {
          taskId,
          userId,
        });
        return null;
      }

      Logger.info('Task updated successfully', {
        taskId: task._id,
        userId,
        updatedFields: Object.keys(updateData),
      });

      return task;
    } catch (error) {
      Logger.error('Error updating task', {
        error: error.message,
        taskId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete task (soft delete)
   */
  async deleteTask(taskId, userId) {
    try {
      const task = await Task.findOne({
        _id: taskId,
        user: userId,
      });

      if (!task) {
        Logger.warn('Task not found for deletion', {
          taskId,
          userId,
        });
        return null;
      }

      await task.softDelete();

      Logger.info('Task deleted successfully', {
        taskId: task._id,
        userId,
        title: task.title,
      });

      return task;
    } catch (error) {
      Logger.error('Error deleting task', {
        error: error.message,
        taskId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Toggle task completion status
   */
  async toggleComplete(taskId, userId) {
    try {
      const task = await Task.findOne({
        _id: taskId,
        user: userId,
      });

      if (!task) {
        return null;
      }

      if (task.isCompleted) {
        await task.markIncomplete();
      } else {
        await task.markComplete();
      }

      await task.populate([
        { path: 'category', select: 'title color' },
        { path: 'status', select: 'name color' },
        { path: 'priority', select: 'name color' },
      ]);

      Logger.info('Task completion toggled', {
        taskId: task._id,
        userId,
        isCompleted: task.isCompleted,
      });

      return task;
    } catch (error) {
      Logger.error('Error toggling task completion', {
        error: error.message,
        taskId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update task image
   */
  async updateTaskImage(taskId, userId, imageData) {
    try {
      const task = await Task.findOneAndUpdate(
        { _id: taskId, user: userId },
        { image: imageData },
        { new: true, runValidators: true }
      )
        .populate('category', 'title color')
        .populate('status', 'name color')
        .populate('priority', 'name color');

      if (!task) {
        return null;
      }

      Logger.info('Task image updated successfully', {
        taskId: task._id,
        userId,
        imageUrl: imageData.url,
      });

      return task;
    } catch (error) {
      Logger.error('Error updating task image', {
        error: error.message,
        taskId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete task image
   */
  async deleteTaskImage(taskId, userId) {
    try {
      const task = await Task.findOneAndUpdate(
        { _id: taskId, user: userId },
        {
          image: {
            url: null,
            publicId: null,
          },
        },
        { new: true }
      )
        .populate('category', 'title color')
        .populate('status', 'name color')
        .populate('priority', 'name color');

      if (!task) {
        return null;
      }

      Logger.info('Task image deleted successfully', {
        taskId: task._id,
        userId,
      });

      return task;
    } catch (error) {
      Logger.error('Error deleting task image', {
        error: error.message,
        taskId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user task statistics
   */
  async getUserTaskStats(userId) {
    try {
      const stats = await Task.aggregate([
        {
          $match: {
            user: userId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: ['$isCompleted', 1, 0] },
            },
            pendingTasks: {
              $sum: { $cond: ['$isCompleted', 0, 1] },
            },
            overdueTasks: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$isCompleted', true] },
                      { $ne: ['$dueDate', null] },
                      { $lt: ['$dueDate', new Date()] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            tasksWithImages: {
              $sum: {
                $cond: [
                  { $ne: ['$image.url', null] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      return stats[0] || {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        tasksWithImages: 0,
      };
    } catch (error) {
      Logger.error('Error getting task stats', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get tasks grouped by category
   */
  async getTasksByCategory(userId) {
    try {
      const stats = await Task.aggregate([
        {
          $match: {
            user: userId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: ['$isCompleted', 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryDetails',
          },
        },
        {
          $unwind: {
            path: '$categoryDetails',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            category: {
              $ifNull: ['$categoryDetails.title', 'Uncategorized'],
            },
            count: 1,
            completed: 1,
            pending: { $subtract: ['$count', '$completed'] },
          },
        },
      ]);

      return stats;
    } catch (error) {
      Logger.error('Error getting tasks by category', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore soft deleted task
   */
  async restoreTask(taskId, userId) {
    try {
      const task = await Task.findOne({
        _id: taskId,
        user: userId,
      }).select('+isDeleted +deletedAt');

      if (!task) {
        return null;
      }

      if (!task.isDeleted) {
        throw new Error('Task is not deleted');
      }

      await task.restore();
      await task.populate([
        { path: 'category', select: 'title color' },
        { path: 'status', select: 'name color' },
        { path: 'priority', select: 'name color' },
      ]);

      Logger.info('Task restored successfully', {
        taskId: task._id,
        userId,
      });

      return task;
    } catch (error) {
      Logger.error('Error restoring task', {
        error: error.message,
        taskId,
        userId,
      });
      throw error;
    }
  }
}

export default new TaskRepository();