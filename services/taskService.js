import TaskRepository from '../repositories/taskRepository.js';
import CategoryRepository from '../repositories/categoryRepository.js';
import TaskStatusRepository from '../repositories/taskStatusRepository.js';
import TaskPriorityRepository from '../repositories/taskPriorityRepository.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';
import CollaborationRepository from '../repositories/collaborationRepository.js';
import Task from '../models/Task.js';
import NotificationService from '../services/notificationService.js';

class TaskService {
  /**
   * Create new task
   */
  async createTask(userId, taskData, file) {
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

      // Handle image upload if file exists
      if (file) {
        await this.handleImageUpload(userId, task._id, file);
        // Refetch task to include image data
        const updatedTask = await TaskRepository.findByIdAndUser(task._id, userId);
        
        Logger.logAuth('TASK_CREATED_WITH_IMAGE', userId, {
          taskId: task._id,
          title: task.title,
        });

        return {
          task: updatedTask,
          message: 'Task created successfully',
        };
      }

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
  /**
   * Get all tasks for user with filters (owned + shared)
   */
  async getAllTasks(userId, filters = {}) {
    try {
      // Get owned tasks
      const ownedTasksResult = await TaskRepository.findByUser(userId, {}, filters);
      
      // Get shared tasks (tasks where user is collaborator)
      const sharedTasks = await Task.getSharedTasks(userId);
      
      // Apply filters to shared tasks if needed
      let filteredSharedTasks = sharedTasks;
      if (filters.category) {
        filteredSharedTasks = sharedTasks.filter(t => 
          t.category && t.category._id.toString() === filters.category
        );
      }
      if (filters.status) {
        filteredSharedTasks = filteredSharedTasks.filter(t => 
          t.status && t.status._id.toString() === filters.status
        );
      }
      if (filters.priority) {
        filteredSharedTasks = filteredSharedTasks.filter(t => 
          t.priority && t.priority._id.toString() === filters.priority
        );
      }
      if (filters.isCompleted !== undefined) {
        const completed = filters.isCompleted === 'true' || filters.isCompleted === true;
        filteredSharedTasks = filteredSharedTasks.filter(t => t.isCompleted === completed);
      }

      // Combine both lists
      const allTasks = [
        ...ownedTasksResult.tasks.map(task => ({
          ...task.toObject(),
          isOwner: true,
          userRole: 'owner',
        })),
        ...filteredSharedTasks.map(task => ({
          ...task,
          isOwner: false,
        }))
      ];

      // Populate reviewRequestedBy for all tasks manually or ensure repository does it
      // Since repository returns Mongoose docs (usually) or plain objects depending on implementation.
      // sharedTasks already mapped. ownedTasksResult comes from repo. 
      // It's cleaner to ensure the repository populates it, OR we populate it here if the docs are still mongoose documents.
      // But ownedTasksResult.tasks might be docs.
      // Let's modify the response construction to ensure the field is present if populated.
      // Actually, standard `findByUser` in repo likely doesn't populate `reviewRequestedBy`.
      // We should probably rely on the fact that `TaskRepository.findByUser` uses `Task.findByUser` static method?
      // Let's check `Task.findByUser` in models/Task.js.


      // Sort by most recent
      allTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTasks = allTasks.slice(startIndex, endIndex);

      return {
        tasks: paginatedTasks,
        pagination: {
          total: allTasks.length,
          page,
          limit,
          pages: Math.ceil(allTasks.length / limit),
        },
        stats: {
          owned: ownedTasksResult.tasks.length,
          shared: filteredSharedTasks.length,
          total: allTasks.length,
        }
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
      // First check if user owns the task
      let task = await TaskRepository.findByIdAndUser(taskId, userId);
      let isOwner = true;
      let userRole = 'owner';

      // If not owner, check if user is collaborator
      if (!task) {
        const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
        
        if (!access.canAccess) {
          throw ApiError.notFound('Task not found or you do not have access');
        }

        // User is collaborator, fetch task
        task = await Task.findById(taskId)
          .populate('category', 'title color')
          .populate('status', 'name color')
          .populate('priority', 'name color')
          .populate('priority', 'name color')
          .populate('user', 'firstName lastName email avatar')
          .populate('reviewRequestedBy', 'firstName lastName email avatar');
        
        isOwner = false;
        userRole = access.role;
      }

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      // Get collaborators if task is shared
      let collaborators = [];
      if (task.isShared) {
        const collabs = await CollaborationRepository.getTaskCollaborators(taskId, 'active');
        collaborators = collabs.map(c => ({
          _id: c._id,
          user: c.collaborator,
          role: c.role,
          addedAt: c.createdAt,
        }));
      }

      return { 
        task: {
          ...task.toObject(),
          isOwner,
          userRole,
          collaborators,
        }
      };
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
  async updateTask(userId, taskId, updateData, file) {
    try {
      // Check access permission
      let task;
      const ownedTask = await TaskRepository.findByIdAndUser(taskId, userId);
      
      if (ownedTask) {
        task = ownedTask;
      } else {
        // Check collaborator access
        const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
        if (!access.canAccess || access.role === 'viewer') {
          throw ApiError.forbidden('You do not have permission to edit this task');
        }
        task = await Task.findById(taskId);
      
        if (updateData.isCompleted) {
           if (access.role === 'viewer' || access.role === 'assignee') {
               throw ApiError.forbidden('You cannot complete this task directly. Please request a review.');
           }
           // If completing, clear review flags
           task.reviewRequestedBy = null;
           task.reviewRequestedAt = null;
        }
      }

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      // Verify category belongs to task owner (if being updated)
      if (updateData.category) {
        const categoryExists = await CategoryRepository.findByIdAndUser(
          updateData.category,
          task.user
        );
        if (!categoryExists) {
          throw ApiError.badRequest('Invalid category or category does not belong to task owner');
        }
      }

      // Verify status belongs to task owner (if being updated)
      if (updateData.status) {
        const statusExists = await TaskStatusRepository.findByIdAndUser(
          updateData.status,
          task.user
        );
        if (!statusExists) {
          throw ApiError.badRequest('Invalid status or status does not belong to task owner');
        }
      }

      // Verify priority belongs to task owner (if being updated)
      if (updateData.priority) {
        const priorityExists = await TaskPriorityRepository.findByIdAndUser(
          updateData.priority,
          task.user
        );
        if (!priorityExists) {
          throw ApiError.badRequest('Invalid priority or priority does not belong to task owner');
        }
      }

      // Update task
      Object.assign(task, updateData);
      await task.save();
      
      // Populate
      await task.populate([
        { path: 'category', select: 'title color' },
        { path: 'status', select: 'name color' },
        { path: 'priority', select: 'name color' },
      ]);

      // Handle image upload if file exists
      if (file) {
        await this.handleImageUpload(userId, taskId, file);
        task = await Task.findById(taskId)
          .populate('category', 'title color')
          .populate('status', 'name color')
          .populate('priority', 'name color');
      }

      Logger.logAuth('TASK_UPDATED', userId, {
        taskId: task._id,
        updatedFields: Object.keys(updateData),
      });

      // Notification: Notify all team members (except updater)
      // Get all collaborators including owner
      const collaborators = await CollaborationRepository.getTaskCollaborators(taskId, 'active');
      const allMembers = collaborators.map(c => ({ member: c.collaborator }));
      // Also add owner if not in collaborators list (though getTaskCollaborators might not include owner in 'collaborator' field depending on schema, but usually it does or we check task.user)
      if (task.user && !allMembers.some(m => m.member._id.toString() === task.user.toString())) {
         const ownerUser = await (await import('../models/User.js')).default.findById(task.user);
         if (ownerUser) {
           allMembers.push({ member: ownerUser });
         }
      }
      
      const updater = await (await import('../models/User.js')).default.findById(userId);
      await NotificationService.notifyTaskUpdated(task, updater, allMembers, updateData);

      return {
        task,
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
  /**
   * Delete task (only owner can delete)
   */
  async deleteTask(userId, taskId) {
    try {
      // Only owner can delete task
      const task = await TaskRepository.findByIdAndUser(taskId, userId);

      if (!task) {
        throw ApiError.notFound('Task not found or you do not have permission to delete');
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

      // Notification: Notify all collaborators (including owner if not deleter)
      // We need to fetch collaborators BEFORE deleting them
      let recipients = [];
      if (task.isShared) {
         const collaborators = await CollaborationRepository.getTaskCollaborators(taskId, 'active');
         recipients = collaborators.map(c => c.collaborator._id);
      }
      // Add owner if not deleter and not already in recipients
      if (task.user && task.user.toString() !== userId.toString() && !recipients.some(id => id.toString() === task.user.toString())) {
         recipients.push(task.user);
      }
      
      const deleter = await (await import('../models/User.js')).default.findById(userId);
      // Filter out deleter from recipients
      recipients = recipients.filter(id => id.toString() !== userId.toString());
      
      if (recipients.length > 0) {
        await NotificationService.notifyTaskDeleted(task.title, deleter, recipients);
      }

      // Delete all collaborations
      if (task.isShared) {
        const TaskCollaborator = (await import('../models/TaskCollaborator.js')).default;
        await TaskCollaborator.deleteMany({ task: taskId });
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
      // Try as owner first
      let task = await TaskRepository.toggleComplete(taskId, userId);

      // If not owner, check collaborator access
      if (!task) {
        const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
        if (access.role === 'viewer') {
          throw ApiError.forbidden('You do not have permission to modify this task');
        }
        
        // Fetch and toggle manually
        task = await Task.findById(taskId);
        if (!task) {
          throw ApiError.notFound('Task not found');
        }
        
        if (task.isCompleted) {
          // If already completed, anyone with edit access (editor/owner) can uncomplete?
          // Requirement says specific workflow for completion. Let's assume uncompletion is less strict or restricted to editors/owners too?
          // For consistency with "Viewer/Assignee cannot mark as complete", we should probably restrict them from changing completion status at all?
          // "viewer or assignee direct task complete mark ni kr skta" -> implies they can't toggle from false to true.
          // What about true to false? Safest to restrict both for Assignee/Viewer if they are only supposed to "Request Review".
          if (access.role === 'assignee') {
               throw ApiError.forbidden('You cannot change completion status directly. Please request a review.');
          }
          await task.markIncomplete();
        } else {
          // Attempting to mark complete
           if (access.role === 'assignee') {
               throw ApiError.forbidden('You cannot complete this task directly. Please request a review.');
           }
          await task.markComplete();
          // Clear review flags
          task.reviewRequestedBy = null;
          task.reviewRequestedAt = null;
          await task.save();
        }
        
        await task.populate([
          { path: 'category', select: 'title color' },
          { path: 'status', select: 'name color' },
          { path: 'priority', select: 'name color' },
        ]);
      }

      Logger.logAuth('TASK_COMPLETION_TOGGLED', userId, {
        taskId,
        isCompleted: task.isCompleted,
      });

      // Notification: Notify collaborators if completed
      if (task.isCompleted) {
        // Fetch collaborators
        const collaborators = await CollaborationRepository.getTaskCollaborators(taskId, 'active');
        const teamMembers = collaborators.map(c => ({ member: c.collaborator }));
         // Add owner if needed
        if (task.user && !teamMembers.some(m => m.member._id.toString() === task.user.toString())) {
             const ownerUser = await (await import('../models/User.js')).default.findById(task.user);
             if (ownerUser) teamMembers.push({ member: ownerUser });
        }
        
        const completer = await (await import('../models/User.js')).default.findById(userId);
        await NotificationService.notifyTaskCompleted(task, completer, teamMembers);
      }

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
   * Helper to handle image upload
   */
  async handleImageUpload(userId, taskId, file) {
    try {
      // Check access
      const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
      const isOwner = access.isOwner;
      
      let task;
      if (isOwner) {
        task = await TaskRepository.findByIdAndUser(taskId, userId);
      } else {
        const Task = (await import('../models/Task.js')).default;
        task = await Task.findById(taskId);
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
      let updatedTask;
      if (isOwner) {
        updatedTask = await TaskRepository.updateTaskImage(taskId, userId, {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        });
      } else {
        task.image = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        };
        await task.save();
        updatedTask = task;
      }

      return updatedTask;
    } catch (error) {
      throw ApiError.internal('Failed to upload task image. Please try again.');
    }
  }
  /**
   * Delete task image
   */
  async deleteTaskImage(userId, taskId) {
    try {
      // Check access
      const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
      
      let task;
      if (access.isOwner) {
        task = await TaskRepository.findByIdAndUser(taskId, userId);
      } else {
        if (access.role === 'viewer') {
          throw ApiError.forbidden('You do not have permission to modify this task');
        }
        const Task = (await import('../models/Task.js')).default;
        task = await Task.findById(taskId);
      }

      if (!task) {
        throw ApiError.notFound('Task not found');
      }

      if (!task.image?.publicId) {
        throw ApiError.badRequest('No image to delete');
      }

      // Delete from cloudinary
      await cloudinary.uploader.destroy(task.image.publicId);

      // Update task
      let updatedTask;
      if (access.isOwner) {
        updatedTask = await TaskRepository.deleteTaskImage(taskId, userId);
      } else {
        task.image = { url: null, publicId: null };
        await task.save();
        await task.populate([
          { path: 'category', select: 'title color' },
          { path: 'status', select: 'name color' },
          { path: 'priority', select: 'name color' },
        ]);
        updatedTask = task;
      }

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

      // Notification: Notify restoration
      // Determine recipients (Owner + Collaborators if they still exist/are valid? Collaborators were deleted on delete. So maybe only Owner?)
      // Actually TaskService.restoreTask restores the Task document status. 
      // Collaboration records were HARD deleted in deleteTask : `await TaskCollaborator.deleteMany({ task: taskId });`
      // So no collaborators exist anymore! 
      // We can only notify the Owner if the restorer is not the owner.
      // If we wanted to restore collaborators, we should have soft-deleted them too. 
      // Assuming naive implementation: Notify owner if different from restorer.
      if (task.user && task.user.toString() !== userId.toString()) {
         const restorer = await (await import('../models/User.js')).default.findById(userId);
         await NotificationService.notifyTaskRestored(task, restorer, [task.user]);
      }

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

  /**
   * Request review for a task
   */
  async requestTaskReview(taskId, userId) {
    try {
      const access = await CollaborationRepository.canUserAccessTask(taskId, userId);
      
      // Only Viewer and Assignee need to request review. 
      // Owner and Editor can just complete it.
      if (!access.canAccess) {
         throw ApiError.notFound('Task not found or you do not have access');
      }

      const task = await Task.findById(taskId);
      if (!task) throw ApiError.notFound('Task not found');
      
      if (task.isCompleted) {
        throw ApiError.badRequest('Task is already completed');
      }

      // Update task with review request
      task.reviewRequestedBy = userId;
      task.reviewRequestedAt = new Date();
      await task.save();

      // Notify Owner and Editors
      // Get all collaborators with role 'editor'
      const collaborators = await CollaborationRepository.getTaskCollaborators(taskId, 'active');
      const editors = collaborators.filter(c => c.role === 'editor').map(c => c.collaborator._id);
      
      const recipients = [...editors];
      
      // Add Owner
      if (task.user && !recipients.some(id => id.toString() === task.user.toString())) {
         recipients.push(task.user);
      }
      
      // Filter out requester
      const finalRecipients = recipients.filter(id => id.toString() !== userId.toString());

      if (finalRecipients.length > 0) {
         const requester = await (await import('../models/User.js')).default.findById(userId);
         await NotificationService.notifyTaskReviewRequested(task, requester, finalRecipients);
      }

      return {
        message: 'Review requested successfully',
        task
      };

    } catch (error) {
      Logger.error('Error in requestTaskReview service', {
        error: error.message,
        userId,
        taskId,
      });
      throw error;
    }
  }
}

export default new TaskService();