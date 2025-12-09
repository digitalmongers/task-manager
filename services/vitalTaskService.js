import VitalTaskRepository from '../repositories/vitalTaskRepository.js';
import CategoryRepository from '../repositories/categoryRepository.js';
import TaskStatusRepository from '../repositories/taskStatusRepository.js';
import TaskPriorityRepository from '../repositories/taskPriorityRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

class VitalTaskService {
  /**
   * Create new vital task
   */
  async createVitalTask(userId, taskData) {
    try {
      const { title, description, dueDate, priority, status, category, isCompleted } = taskData;

      // Verify category belongs to user (if provided)
      if (category) {
        const categoryExists = await CategoryRepository.findByIdAndUser(category, userId);
        if (!categoryExists) {
          throw ApiError.badRequest('Invalid category or category does not belong to you');
        }
      }

      // Verify status belongs to user (if provided)
      if (status) {
        const statusExists = await TaskStatusRepository.findByIdAndUser(status, userId);
        if (!statusExists) {
          throw ApiError.badRequest('Invalid status or status does not belong to you');
        }
      }

      // Verify priority belongs to user (if provided)
      if (priority) {
        const priorityExists = await TaskPriorityRepository.findByIdAndUser(priority, userId);
        if (!priorityExists) {
          throw ApiError.badRequest('Invalid priority or priority does not belong to you');
        }
      }

      // Create vital task
      const vitalTask = await VitalTaskRepository.createVitalTask(
        {
          title,
          description: description || null,
          dueDate: dueDate || null,
          priority: priority || null,
          status: status || null,
          category: category || null,
          isCompleted: isCompleted || false,
        },
        userId
      );

      Logger.logAuth('VITAL_TASK_CREATED', userId, {
        vitalTaskId: vitalTask._id,
        title: vitalTask.title,
      });

      return {
        vitalTask,
        message: 'Vital task created successfully',
      };
    } catch (error) {
      Logger.error('Error in createVitalTask service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all vital tasks for user with filters
   */
  async getAllVitalTasks(userId, filters = {}) {
    try {
      const result = await VitalTaskRepository.findByUser(userId, {}, filters);

      return {
        vitalTasks: result.vitalTasks,
        pagination: result.pagination,
      };
    } catch (error) {
      Logger.error('Error in getAllVitalTasks service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get single vital task by ID
   */
  async getVitalTaskById(userId, taskId) {
    try {
      const vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      return { vitalTask };
    } catch (error) {
      Logger.error('Error in getVitalTaskById service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Update vital task
   */
  async updateVitalTask(userId, taskId, updateData) {
    try {
      // Check if vital task exists and belongs to user
      const existingVitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);

      if (!existingVitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      // Verify category belongs to user (if being updated)
      if (updateData.category) {
        const categoryExists = await CategoryRepository.findByIdAndUser(
          updateData.category,
          userId
        );
        if (!categoryExists) {
          throw ApiError.badRequest('Invalid category or category does not belong to you');
        }
      }

      // Verify status belongs to user (if being updated)
      if (updateData.status) {
        const statusExists = await TaskStatusRepository.findByIdAndUser(
          updateData.status,
          userId
        );
        if (!statusExists) {
          throw ApiError.badRequest('Invalid status or status does not belong to you');
        }
      }

      // Verify priority belongs to user (if being updated)
      if (updateData.priority) {
        const priorityExists = await TaskPriorityRepository.findByIdAndUser(
          updateData.priority,
          userId
        );
        if (!priorityExists) {
          throw ApiError.badRequest('Invalid priority or priority does not belong to you');
        }
      }

      // Update vital task
      const updatedVitalTask = await VitalTaskRepository.updateVitalTask(taskId, userId, updateData);

      Logger.logAuth('VITAL_TASK_UPDATED', userId, {
        vitalTaskId: updatedVitalTask._id,
        updatedFields: Object.keys(updateData),
      });

      return {
        vitalTask: updatedVitalTask,
        message: 'Vital task updated successfully',
      };
    } catch (error) {
      Logger.error('Error in updateVitalTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Delete vital task
   */
  async deleteVitalTask(userId, taskId) {
    try {
      // Check if vital task exists and belongs to user
      const vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      // Delete image from cloudinary if exists
      if (vitalTask.image?.publicId) {
        await cloudinary.uploader.destroy(vitalTask.image.publicId).catch((error) => {
          Logger.warn('Failed to delete vital task image from cloudinary', {
            taskId,
            publicId: vitalTask.image.publicId,
            error: error.message,
          });
        });
      }

      // Soft delete vital task
      await VitalTaskRepository.deleteVitalTask(taskId, userId);

      Logger.logAuth('VITAL_TASK_DELETED', userId, {
        vitalTaskId: taskId,
        title: vitalTask.title,
      });

      return {
        message: 'Vital task deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteVitalTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Toggle vital task completion
   */
  async toggleComplete(userId, taskId) {
    try {
      const vitalTask = await VitalTaskRepository.toggleComplete(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      Logger.logAuth('VITAL_TASK_COMPLETION_TOGGLED', userId, {
        vitalTaskId: taskId,
        isCompleted: vitalTask.isCompleted,
      });

      return {
        vitalTask,
        message: vitalTask.isCompleted ? 'Vital task marked as completed' : 'Vital task marked as incomplete',
      };
    } catch (error) {
      Logger.error('Error in toggleComplete service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Upload vital task image
   */
  async uploadVitalTaskImage(userId, taskId, file) {
    try {
      const vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      // Delete old image if exists
      if (vitalTask.image?.publicId) {
        await cloudinary.uploader.destroy(vitalTask.image.publicId).catch((error) => {
          Logger.warn('Failed to delete old vital task image', {
            taskId,
            publicId: vitalTask.image.publicId,
            error: error.message,
          });
        });
      }

      // Upload new image
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'task-manager/vital-tasks',
            resource_type: 'image',
            transformation: [
              { width: 800, height: 600, crop: 'limit' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(stream);
      });

      // Update vital task with new image
      const updatedVitalTask = await VitalTaskRepository.updateVitalTaskImage(taskId, userId, {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });

      Logger.logAuth('VITAL_TASK_IMAGE_UPLOADED', userId, {
        vitalTaskId: taskId,
        imageUrl: uploadResult.secure_url,
      });

      return {
        vitalTask: updatedVitalTask,
        message: 'Vital task image uploaded successfully',
      };
    } catch (error) {
      Logger.error('Error in uploadVitalTaskImage service', {
        error: error.message,
        userId,
        taskId,
      });
      throw ApiError.internal('Failed to upload vital task image. Please try again.');
    }
  }

  /**
   * Delete vital task image
   */
  async deleteVitalTaskImage(userId, taskId) {
    try {
      const vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      if (!vitalTask.image?.publicId) {
        throw ApiError.badRequest('No image to delete');
      }

      // Delete from cloudinary
      await cloudinary.uploader.destroy(vitalTask.image.publicId);

      // Update vital task
      const updatedVitalTask = await VitalTaskRepository.deleteVitalTaskImage(taskId, userId);

      Logger.logAuth('VITAL_TASK_IMAGE_DELETED', userId, {
        vitalTaskId: taskId,
      });

      return {
        vitalTask: updatedVitalTask,
        message: 'Vital task image deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteVitalTaskImage service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Get vital task statistics
   */
  async getVitalTaskStats(userId) {
    try {
      const stats = await VitalTaskRepository.getUserVitalTaskStats(userId);

      return {
        stats,
      };
    } catch (error) {
      Logger.error('Error in getVitalTaskStats service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore deleted vital task
   */
  async restoreVitalTask(userId, taskId) {
    try {
      const vitalTask = await VitalTaskRepository.restoreVitalTask(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      Logger.logAuth('VITAL_TASK_RESTORED', userId, {
        vitalTaskId: taskId,
      });

      return {
        vitalTask,
        message: 'Vital task restored successfully',
      };
    } catch (error) {
      Logger.error('Error in restoreVitalTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Convert vital task to regular task
   */
  async convertToRegularTask(userId, taskId) {
    try {
      // Get the vital task
      const vitalTask = await VitalTaskRepository.findByIdAndUser(taskId, userId);

      if (!vitalTask) {
        throw ApiError.notFound('Vital task not found');
      }

      // Import TaskRepository dynamically to avoid circular dependency
      const TaskRepository = (await import('../repositories/taskRepository.js')).default;

      // Create regular task with same data
      const task = await TaskRepository.createTask(
        {
          title: vitalTask.title,
          description: vitalTask.description,
          dueDate: vitalTask.dueDate,
          priority: vitalTask.priority,
          status: vitalTask.status,
          category: vitalTask.category,
          isCompleted: vitalTask.isCompleted,
          image: vitalTask.image,
        },
        userId
      );

      // Soft delete the vital task
      await VitalTaskRepository.deleteVitalTask(taskId, userId);

      Logger.logAuth('VITAL_TASK_CONVERTED_TO_REGULAR', userId, {
        vitalTaskId: taskId,
        regularTaskId: task._id,
        title: vitalTask.title,
      });

      return {
        task,
        message: 'Vital task converted to regular task successfully',
      };
    } catch (error) {
      Logger.error('Error in convertToRegularTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }
}

export default new VitalTaskService();