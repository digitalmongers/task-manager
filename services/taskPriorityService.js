import TaskPriorityRepository from '../repositories/taskPriorityRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

class TaskPriorityService {
  /**
   * Create new task priority
   */
  async createTaskPriority(userId, priorityData) {
    try {
      const { name, description, color } = priorityData;

      // Check if priority with same name already exists for this user
      const nameExists = await TaskPriorityRepository.nameExists(userId, name);
      if (nameExists) {
        throw ApiError.conflict('A priority with this name already exists');
      }

      // Create task priority
      const priority = await TaskPriorityRepository.createTaskPriority(
        {
          name,
          description: description || null,
          color: color || '#F59E0B',
        },
        userId
      );

      Logger.logAuth('TASK_PRIORITY_CREATED', userId, {
        priorityId: priority._id,
        name: priority.name,
      });

      return {
        priority,
        message: 'Task priority created successfully',
      };
    } catch (error) {
      Logger.error('Error in createTaskPriority service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all task priorities for user
   */
  async getAllTaskPriorities(userId, options = {}) {
    try {
      const priorities = await TaskPriorityRepository.findByUser(userId, options);

      return {
        priorities,
        count: priorities.length,
      };
    } catch (error) {
      Logger.error('Error in getAllTaskPriorities service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get single task priority by ID
   */
  async getTaskPriorityById(userId, priorityId) {
    try {
      const priority = await TaskPriorityRepository.findByIdAndUser(
        priorityId,
        userId
      );

      if (!priority) {
        throw ApiError.notFound('Task priority not found');
      }

      return { priority };
    } catch (error) {
      Logger.error('Error in getTaskPriorityById service', {
        error: error.message,
        userId,
        priorityId,
      });
      throw error;
    }
  }

  /**
   * Update task priority
   */
  async updateTaskPriority(userId, priorityId, updateData) {
    try {
      // Check if priority exists and belongs to user
      const existingPriority = await TaskPriorityRepository.findByIdAndUser(
        priorityId,
        userId
      );

      if (!existingPriority) {
        throw ApiError.notFound('Task priority not found');
      }

      // If name is being updated, check for duplicates
      if (updateData.name && updateData.name !== existingPriority.name) {
        const nameExists = await TaskPriorityRepository.nameExists(
          userId,
          updateData.name,
          priorityId
        );

        if (nameExists) {
          throw ApiError.conflict('A priority with this name already exists');
        }
      }

      // Update task priority
      const updatedPriority = await TaskPriorityRepository.updateTaskPriority(
        priorityId,
        userId,
        updateData
      );

      Logger.logAuth('TASK_PRIORITY_UPDATED', userId, {
        priorityId: updatedPriority._id,
        updatedFields: Object.keys(updateData),
      });

      return {
        priority: updatedPriority,
        message: 'Task priority updated successfully',
      };
    } catch (error) {
      Logger.error('Error in updateTaskPriority service', {
        error: error.message,
        userId,
        priorityId,
      });
      throw error;
    }
  }

  /**
   * Delete task priority
   */
  async deleteTaskPriority(userId, priorityId) {
    try {
      // Check if priority exists and belongs to user
      const priority = await TaskPriorityRepository.findByIdAndUser(
        priorityId,
        userId
      );

      if (!priority) {
        throw ApiError.notFound('Task priority not found');
      }

      // TODO: Optional - Check if priority is being used by any tasks
      // If you want to prevent deletion of priorities with tasks:
      // const taskCount = await TaskRepository.countByPriorityId(priorityId);
      // if (taskCount > 0) {
      //   throw ApiError.badRequest('Cannot delete priority with existing tasks');
      // }

      // Soft delete priority
      await TaskPriorityRepository.deleteTaskPriority(priorityId, userId);

      Logger.logAuth('TASK_PRIORITY_DELETED', userId, {
        priorityId,
        name: priority.name,
      });

      return {
        message: 'Task priority deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteTaskPriority service', {
        error: error.message,
        userId,
        priorityId,
      });
      throw error;
    }
  }

  /**
   * Get task priority statistics
   */
  async getTaskPriorityStats(userId) {
    try {
      const stats = await TaskPriorityRepository.getUserPriorityStats(userId);

      return { stats };
    } catch (error) {
      Logger.error('Error in getTaskPriorityStats service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore deleted task priority (optional feature)
   */
  async restoreTaskPriority(userId, priorityId) {
    try {
      const priority = await TaskPriorityRepository.restoreTaskPriority(
        priorityId,
        userId
      );

      if (!priority) {
        throw ApiError.notFound('Task priority not found');
      }

      Logger.logAuth('TASK_PRIORITY_RESTORED', userId, {
        priorityId,
      });

      return {
        priority,
        message: 'Task priority restored successfully',
      };
    } catch (error) {
      Logger.error('Error in restoreTaskPriority service', {
        error: error.message,
        userId,
        priorityId,
      });
      throw error;
    }
  }
}

export default new TaskPriorityService();