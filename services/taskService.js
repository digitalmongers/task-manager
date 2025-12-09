import TaskRepository from '../repositories/taskRepository.js';
import CategoryRepository from '../repositories/categoryRepository.js';
import TaskStatusRepository from '../repositories/taskStatusRepository.js';
import TaskPriorityRepository from '../repositories/taskPriorityRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

class TaskService {
  /**
   * Create new task
   */
  async createTask(userId, taskData) {
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

      // Create task
      const task = await TaskRepository.createTask(
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

      Logger.logAuth('TASK_CREATED', userId, {
        taskId: task._id,
        title: task.title,
      });

      return {
        task,
        message: 'Task created successfully',
      };
    } catch (error) {
      Logger.error('Error in createTask service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all tasks for user with filters
   */
  async getAllTasks(userId, filters = {}) {
    try {
      const result = await TaskRepository.findByUser(userId, {}, filters);

      return {
        tasks: result.tasks,
        pagination: result.pagination,
      };
    } catch (error) {
      Logger.error('Error in getAllTasks service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get single task by ID
   */
  async getTaskById(userId, taskId) {
    try {
      const task = await TaskRepository.findByIdAndUser(taskId, userId);

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      return { task };
    } catch (error) {
      Logger.error('Error in getTaskById service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Update task
   */
  async updateTask(userId, taskId, updateData) {
    try {
      // Check if task exists and belongs to user
      const existingTask = await TaskRepository.findByIdAndUser(taskId, userId);

      if (!existingTask) {
        throw ApiError.notFound('Task not found');
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

      // Update task
      const updatedTask = await TaskRepository.updateTask(taskId, userId, updateData);

      Logger.logAuth('TASK_UPDATED', userId, {
        taskId: updatedTask._id,
        updatedFields: Object.keys(updateData),
      });

      return {
        task: updatedTask,
        message: 'Task updated successfully',
      };
    } catch (error) {
      Logger.error('Error in updateTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Delete task
   */
  async deleteTask(userId, taskId) {
    try {
      // Check if task exists and belongs to user
      const task = await TaskRepository.findByIdAndUser(taskId, userId);

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      // Delete image from cloudinary if exists
      if (task.image?.publicId) {
        await cloudinary.uploader.destroy(task.image.publicId).catch((error) => {
          Logger.warn('Failed to delete task image from cloudinary', {
            taskId,
            publicId: task.image.publicId,
            error: error.message,
          });
        });
      }

      // Soft delete task
      await TaskRepository.deleteTask(taskId, userId);

      Logger.logAuth('TASK_DELETED', userId, {
        taskId,
        title: task.title,
      });

      return {
        message: 'Task deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Toggle task completion
   */
  async toggleComplete(userId, taskId) {
    try {
      const task = await TaskRepository.toggleComplete(taskId, userId);

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      Logger.logAuth('TASK_COMPLETION_TOGGLED', userId, {
        taskId,
        isCompleted: task.isCompleted,
      });

      return {
        task,
        message: task.isCompleted ? 'Task marked as completed' : 'Task marked as incomplete',
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
   * Upload task image
   */
  async uploadTaskImage(userId, taskId, file) {
    try {
      const task = await TaskRepository.findByIdAndUser(taskId, userId);

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      // Delete old image if exists
      if (task.image?.publicId) {
        await cloudinary.uploader.destroy(task.image.publicId).catch((error) => {
          Logger.warn('Failed to delete old task image', {
            taskId,
            publicId: task.image.publicId,
            error: error.message,
          });
        });
      }

      // Upload new image
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'task-manager/tasks',
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

      // Update task with new image
      const updatedTask = await TaskRepository.updateTaskImage(taskId, userId, {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      });

      Logger.logAuth('TASK_IMAGE_UPLOADED', userId, {
        taskId,
        imageUrl: uploadResult.secure_url,
      });

      return {
        task: updatedTask,
        message: 'Task image uploaded successfully',
      };
    } catch (error) {
      Logger.error('Error in uploadTaskImage service', {
        error: error.message,
        userId,
        taskId,
      });
      throw ApiError.internal('Failed to upload task image. Please try again.');
    }
  }

  /**
   * Delete task image
   */
  async deleteTaskImage(userId, taskId) {
    try {
      const task = await TaskRepository.findByIdAndUser(taskId, userId);

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      if (!task.image?.publicId) {
        throw ApiError.badRequest('No image to delete');
      }

      // Delete from cloudinary
      await cloudinary.uploader.destroy(task.image.publicId);

      // Update task
      const updatedTask = await TaskRepository.deleteTaskImage(taskId, userId);

      Logger.logAuth('TASK_IMAGE_DELETED', userId, {
        taskId,
      });

      return {
        task: updatedTask,
        message: 'Task image deleted successfully',
      };
    } catch (error) {
      Logger.error('Error in deleteTaskImage service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStats(userId) {
    try {
      const stats = await TaskRepository.getUserTaskStats(userId);
      const categoryStats = await TaskRepository.getTasksByCategory(userId);

      return {
        stats: {
          ...stats,
          byCategory: categoryStats,
        },
      };
    } catch (error) {
      Logger.error('Error in getTaskStats service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user's dropdown options (categories, statuses, priorities)
   */
  async getDropdownOptions(userId) {
    try {
      const categories = await CategoryRepository.findByUser(userId);
      const statuses = await TaskStatusRepository.findByUser(userId);
      const priorities = await TaskPriorityRepository.findByUser(userId);

      return {
        categories: categories.map(c => ({
          _id: c._id,
          title: c.title,
          color: c.color,
        })),
        statuses: statuses.map(s => ({
          _id: s._id,
          name: s.name,
          color: s.color,
        })),
        priorities: priorities.map(p => ({
          _id: p._id,
          name: p.name,
          color: p.color,
        })),
      };
    } catch (error) {
      Logger.error('Error in getDropdownOptions service', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Restore deleted task
   */
  async restoreTask(userId, taskId) {
    try {
      const task = await TaskRepository.restoreTask(taskId, userId);

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      Logger.logAuth('TASK_RESTORED', userId, {
        taskId,
      });

      return {
        task,
        message: 'Task restored successfully',
      };
    } catch (error) {
      Logger.error('Error in restoreTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }

  /**
   * Convert regular task to vital task
   */
  async convertToVitalTask(userId, taskId) {
    try {
      // Get the regular task
      const task = await TaskRepository.findByIdAndUser(taskId, userId);

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      // Import VitalTaskRepository dynamically to avoid circular dependency
      const VitalTaskRepository = (await import('../repositories/vitalTaskRepository.js')).default;

      // Create vital task with same data
      const vitalTask = await VitalTaskRepository.createVitalTask(
        {
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          status: task.status,
          category: task.category,
          isCompleted: task.isCompleted,
          image: task.image,
        },
        userId
      );

      // Soft delete the original task
      await TaskRepository.deleteTask(taskId, userId);

      Logger.logAuth('TASK_CONVERTED_TO_VITAL', userId, {
        originalTaskId: taskId,
        vitalTaskId: vitalTask._id,
        title: task.title,
      });

      return {
        vitalTask,
        message: 'Task converted to vital task successfully',
      };
    } catch (error) {
      Logger.error('Error in convertToVitalTask service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }
}

export default new TaskService();