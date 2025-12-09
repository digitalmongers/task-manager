import TaskStatusRepository from '../repositories/taskStatusRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

class TaskStatusService {
  /**
   * Create new task status
   */
  async createTaskStatus(userId, statusData) {
    try {
      const { name, description, color } = statusData;

      // Check if status with same name already exists for this user
      const nameExists = await TaskStatusRepository.nameExists(userId, name);
      if (nameExists) {
        throw ApiError.conflict('A status with this name already exists');
      }

      // Create task status
      const status = await TaskStatusRepository.createTaskStatus(
        {
          name,
          description: description || null,
          color: color || '#10B981',
        },
        userId
      );

      Logger.logAuth('TASK_STATUS_CREATED', userId, {
        statusId: status._id,
        name: status.name,
      });

      return {
        status,
        message: 'Task status created successfully',
      };
    } catch (error) {
      Logger.error('Error in createTaskStatus service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all task statuses for user
   */
  async getAllTaskStatuses(userId, options = {}) {
    try {
      const statuses = await TaskStatusRepository.findByUser(userId, options);

      return {
        statuses,
        count: statuses.length,
      };
    } catch (error) {
      Logger.error('Error in getAllTaskStatuses service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get single task status by ID
   */
  async getTaskStatusById(userId, statusId) {
    try {
      const status = await TaskStatusRepository.findByIdAndUser(
        statusId,
        userId
      );

      if (!status) {
        throw ApiError.notFound('Task status not found');
      }

      return { status };
    } catch (error) {
      Logger.error('Error in getTaskStatusById service', {
        error: error.message,
        userId,
        statusId,
      });
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(userId, statusId, updateData) {
    try {
      // Check if status exists and belongs to user
      const existingStatus = await TaskStatusRepository.findByIdAndUser(
        statusId,
        userId
      );

      if (!existingStatus) {
        throw ApiError.notFound('Task status not found');
      }

      // If name is being updated, check for duplicates
      if (updateData.name && updateData.name !== existingStatus.name) {
        const nameExists = await TaskStatusRepository.nameExists(
          userId,
          updateData.name,
          statusId
        );

        if (nameExists) {
          throw ApiError.conflict('A status with this name already exists');
        }
      }

      // Update task status
      const updatedStatus = await TaskStatusRepository.updateTaskStatus(
        statusId,
        userId,
        updateData
      );

      Logger.logAuth('TASK_STATUS_UPDATED', userId, {
        statusId: updatedStatus._id,
        updatedFields: Object.keys(updateData),
      });

      return {
        status: updatedStatus,
        message: 'Task status updated successfully',
      };
    } catch (error) {
      Logger.error('Error in updateTaskStatus service', {
        error: error.message,
        userId,
        statusId,
      });
      throw error;
    }
  }

  /**
   * Delete task status
   */
  async deleteTaskStatus(userId, statusId) {
    try {
      // Check if status exists and belongs to user
      const status = await TaskStatusRepository.findByIdAndUser(
        statusId,
        userId
      );

      if (!status) {
        throw ApiError.notFound('Task status not found');
      }

      // TODO: Optional - Check if status is being used by any tasks
      // If you want to prevent deletion of statuses with tasks:
      // const taskCount = await TaskRepository.countByStatusId(statusId);
      // if (taskCount > 0) {
      //   throw ApiError.badRequest('Cannot delete status with existing tasks');
      // }

      // Soft delete status
      await TaskStatusRepository.deleteTaskStatus(statusId, userId);

      Logger.logAuth('TASK_STATUS_DELETED', userId, {
        statusId,
        name: status.name,
      });

      return {
        message: 'Task status deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteTaskStatus service', {
        error: error.message,
        userId,
        statusId,
      });
      throw error;
    }
  }

  /**
   * Get task status statistics
   */
  async getTaskStatusStats(userId) {
    try {
      const stats = await TaskStatusRepository.getUserStatusStats(userId);

      return { stats };
    } catch (error) {
      Logger.error('Error in getTaskStatusStats service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore deleted task status (optional feature)
   */
  async restoreTaskStatus(userId, statusId) {
    try {
      const status = await TaskStatusRepository.restoreTaskStatus(
        statusId,
        userId
      );

      if (!status) {
        throw ApiError.notFound('Task status not found');
      }

      Logger.logAuth('TASK_STATUS_RESTORED', userId, {
        statusId,
      });

      return {
        status,
        message: 'Task status restored successfully',
      };
    } catch (error) {
      Logger.error('Error in restoreTaskStatus service', {
        error: error.message,
        userId,
        statusId,
      });
      throw error;
    }
  }
}

export default new TaskStatusService();